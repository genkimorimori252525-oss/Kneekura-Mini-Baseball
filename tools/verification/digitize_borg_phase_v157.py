"""Read gray ensemble-mean traces; missing or competing pixels stay unknown.

This is image measurement, not a flight solver or a reconstruction of raw force.
Original PDFs/images remain outside the repository. Only derived data is saved.
"""
import argparse
import csv
import hashlib
import json
import math
from pathlib import Path
from statistics import median

from PIL import Image


def digitize_columns(image, calibration, angles):
    rgb = image.convert('RGB')
    left, right, top, bottom = (float(calibration[key]) for key in ('left', 'right', 'top', 'bottom'))
    low, high = float(calibration['cl_min']), float(calibration['cl_max'])
    if not all(math.isfinite(value) for value in [left, right, top, bottom, low, high]) or not (0 <= left < right < rgb.width and 0 <= top < bottom < rgb.height and low < high):
        raise ValueError('finite, ordered pixel calibration inside image required')
    excluded = calibration.get('exclude_rects', [])
    rows = []
    for phase in angles:
        phase = float(phase)
        if not math.isfinite(phase) or not 0 <= phase <= 360:
            raise ValueError('phase must be inside the independently recorded 0..360 degree cycle')
        x = round(left + phase * (right - left) / 360)
        ys = [y for y in range(math.ceil(top) + 1, math.floor(bottom))
              if not any(x0 <= x <= x1 and y0 <= y <= y1 for x0, y0, x1, y1 in excluded)]
        candidates = []
        if ys:
            pixels = {y: rgb.getpixel((x, y)) for y in ys}
            white = [median(pixel[channel] for pixel in pixels.values()) for channel in range(3)]
            black = [min(pixel[channel] for pixel in pixels.values()) for channel in range(3)]
            if all(white[channel] - black[channel] >= 40 for channel in range(3)):
                normalized = {y: [(pixel[channel] - black[channel]) / (white[channel] - black[channel])
                                  for channel in range(3)] for y, pixel in pixels.items()}
                near_black = {y for y, values in normalized.items() if sum(values) / 3 < .25}
                eligible = []
                for y, values in normalized.items():
                    mean = sum(values) / 3
                    if .42 <= mean <= .68 and max(values) - min(values) <= .12 and not any(abs(y - dark) <= 2 for dark in near_black):
                        eligible.append(y)
                runs = []
                for y in eligible:
                    if not runs or y != runs[-1][-1] + 1:
                        runs.append([y])
                    else:
                        runs[-1].append(y)
                for run in runs:
                    if 2 <= len(run) <= 40:
                        center = (run[0] + run[-1]) / 2
                        coefficient = high - (center - top) * (high - low) / (bottom - top)
                        candidates.append({'pixel_y': center, 'coefficient': coefficient,
                                           'pixel_run_from': run[0], 'pixel_run_through': run[-1]})
        status = 'VISIBLE' if len(candidates) == 1 else 'AMBIGUOUS' if candidates else 'MISSING_OR_OCCLUDED'
        rows.append({'phase_degrees': phase, 'pixel_x': x, 'status': status,
                     'coefficient': candidates[0]['coefficient'] if len(candidates) == 1 else None,
                     'candidates': candidates})
    return rows


PDF_SHA256 = '706ee54ec495c5e174d531d20a025cb53fa5c236e1a8755dafb7b36282cecff9'
FIGURES = [
    {'figure': 4, 'pattern': '4S', 'pdf_page_index': 4, 'folio': 924, 'image_index': 1,
     'calibration': {'left': 109, 'right': 869, 'top': 8, 'bottom': 461, 'cl_min': -.3, 'cl_max': .3,
                     'exclude_rects': [(461, 7, 872, 48)]}},
    {'figure': 6, 'pattern': '2S', 'pdf_page_index': 5, 'folio': 925, 'image_index': 0,
     'calibration': {'left': 107, 'right': 860, 'top': 8, 'bottom': 499, 'cl_min': -.4, 'cl_max': .4,
                     'exclude_rects': [(119, 8, 330, 113), (545, 24, 742, 64)]}},
]
sha = lambda value: hashlib.sha256(value).hexdigest()


def derived_plot(curves, output):
    from reportlab.pdfgen import canvas
    doc = canvas.Canvas(str(output), pagesize=(760, 410))
    doc.setTitle('Digitized low-spin ensemble mean: incomplete readings')
    doc.setFont('Helvetica', 12)
    doc.drawString(35, 385, 'Digitized ensemble-mean total lift (50 rpm); not instantaneous force')
    for index, curve in enumerate(curves):
        x0, y0, width, height = 45 + index * 375, 77, 300, 255
        low, high = curve['calibration']['cl_min'], curve['calibration']['cl_max']
        doc.setStrokeColorRGB(.75, .75, .75)
        doc.rect(x0, y0, width, height)
        doc.setFont('Helvetica', 8)
        for angle in range(0, 361, 60):
            x = x0 + angle / 360 * width
            doc.line(x, y0, x, y0 + height)
            doc.drawCentredString(x, y0 - 13, str(angle))
        for step in range(round(low * 10), round(high * 10) + 1):
            value = step / 10
            y = y0 + (value - low) / (high - low) * height
            doc.line(x0, y, x0 + width, y)
            doc.drawRightString(x0 - 4, y - 3, f'{value:.1f}')
        doc.setFont('Helvetica', 10)
        doc.drawString(x0, y0 + height + 13, f"Figure {curve['figure']} / {curve['pattern']} - gray spinning trace")
        doc.drawCentredString(x0 + width / 2, y0 - 29, 'Displayed material angle (degrees)')
        previous = None
        for row in curve['points']:
            x = x0 + row['phase_degrees'] / 360 * width
            if row['coefficient'] is None:
                doc.setFillColorRGB(.75, .25, .15)
                doc.circle(x, y0 - 3, 1.7, stroke=0, fill=1)
                previous = None
                continue
            y = y0 + (row['coefficient'] - low) / (high - low) * height
            doc.setStrokeColorRGB(.1, .4, .3)
            doc.setFillColorRGB(.1, .4, .3)
            if previous is not None:
                doc.line(previous[0], previous[1], x, y)
            doc.circle(x, y, 1.7, stroke=0, fill=1)
            error = curve['chartReading']['coefficientPixelBound'] / (high - low) * height
            doc.setStrokeColorRGB(.45, .65, .55)
            doc.line(x, y - error, x, y + error)
            previous = (x, y)
    doc.setFont('Helvetica', 8)
    doc.setFillColorRGB(.15, .15, .15)
    doc.drawString(35, 29, 'Red baseline marks = missing/ambiguous. Gaps are not imputed; endpoint differences are retained.')
    doc.drawString(35, 16, 'Derived readings from Borg & Morrissey (2014), DOI 10.1119/1.4885341. Original figure is not reproduced.')
    doc.showPage()
    doc.save()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--pdf', required=True)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()
    source, out = Path(args.pdf), Path(args.out)
    data = source.read_bytes()
    if sha(data) != PDF_SHA256:
        raise ValueError('the reviewed source PDF bytes must match; review a new version separately')
    out.mkdir(parents=True, exist_ok=False)
    from pypdf import PdfReader
    reader = PdfReader(source)
    curves = []
    for spec in FIGURES:
        embedded = list(reader.pages[spec['pdf_page_index']].images)[spec['image_index']]
        image = embedded.image
        points = digitize_columns(image, spec['calibration'], range(0, 361, 5))
        calibration = spec['calibration']
        x_scale, y_scale = calibration['right'] - calibration['left'], calibration['bottom'] - calibration['top']
        endpoints = [points[0]['coefficient'], points[-1]['coefficient']]
        curves.append({**spec, 'embeddedImageName': embedded.name, 'embeddedImageSize': list(image.size),
                       'embeddedImageSha256': sha(embedded.data),
                       'chartReading': {'phasePixelBound': 2, 'coefficientCenterPixelBound': 4,
                                        'phaseDegreesPixelBound': 2 / x_scale * 360,
                                        'coefficientPixelBound': 4 / y_scale * (calibration['cl_max'] - calibration['cl_min']),
                                        'boundsAreMeasurementConfidenceIntervals': False},
                       'points': points,
                       'statusCounts': {status: sum(row['status'] == status for row in points)
                                        for status in ['VISIBLE', 'MISSING_OR_OCCLUDED', 'AMBIGUOUS']},
                       'periodicClosureApplied': False, 'endpointDifference': None if None in endpoints else endpoints[1] - endpoints[0]})
    record = {'version': 'borg_phase_digitization_v157', 'sourceUrl': 'https://baseball.physics.illinois.edu/KBall/Borg-AJP-Oct14.pdf',
              'doi': '10.1119/1.4885341', 'pdfSha256': sha(data), 'pdfBytes': len(data),
              'method': 'COLUMN_GRAY_RUNS_NORMALIZED_BY_BACKGROUND_AND_BLACK_REFERENCE_WITH_GEOMETRIC_LEGEND_MASK',
              'dataMeaning': 'DIGITIZED_ENSEMBLE_MEAN_TOTAL_LIFT_NOT_RAW_FORCE',
              'conditionsReported': {'rpm': 50, 'reynoldsNumber': 160000, 'relativeWindInDrawing': 'RIGHT_TO_LEFT',
                                     'positiveLiftInDrawing': 'UP', 'increasingDisplayedAngle': 'CLOCKWISE'},
              'nativeAdmission': False, 'worldSignedSpinMapping': None, 'fullMaterialQuaternionBasis': None,
              'dynamicLateralCoefficient': None, 'missingValuesImputed': False, 'curves': curves}
    with (out / 'digitized-phase.json').open('x', encoding='utf8') as target:
        json.dump(record, target, ensure_ascii=False, indent=2)
        target.write('\n')
    with (out / 'digitized-phase.csv').open('x', encoding='utf8', newline='') as target:
        writer = csv.DictWriter(target, fieldnames=['figure', 'pattern', 'phase_degrees', 'coefficient', 'status', 'candidate_count', 'candidate_coefficients'])
        writer.writeheader()
        for curve in curves:
            for row in curve['points']:
                writer.writerow({'figure': curve['figure'], 'pattern': curve['pattern'], **{key: row[key] for key in ['phase_degrees', 'coefficient', 'status']},
                                 'candidate_count': len(row['candidates']), 'candidate_coefficients': json.dumps([c['coefficient'] for c in row['candidates']])})
    derived_plot(curves, out / 'digitized-mean-qa.pdf')
    if sha(source.read_bytes()) != PDF_SHA256:
        raise ValueError('source PDF changed during extraction')
    print(json.dumps({'complete': True, 'sourcePdfSha256': PDF_SHA256, 'curves': [{'figure': c['figure'], 'statuses': c['statusCounts'],
                      'endpointDifference': c['endpointDifference']} for c in curves], 'worldPhysicsAdopted': False}))


if __name__ == '__main__':
    main()
