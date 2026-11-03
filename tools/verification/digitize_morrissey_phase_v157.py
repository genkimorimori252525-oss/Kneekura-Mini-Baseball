"""Color-separated chart readings, with units and unknown offsets preserved.

The source figure is an averaged/filtered wind-tunnel measurement, not a free
flight trace. This module does not create or execute a physical force profile.
"""
import argparse
import csv
import hashlib
import json
import math
from pathlib import Path


def digitize_color_columns(image, calibration, angles):
    rgb = image.convert('RGB')
    left, right, top, bottom = (float(calibration[key]) for key in ('left', 'right', 'top', 'bottom'))
    low, high = float(calibration['value_min']), float(calibration['value_max'])
    color = calibration['series_color']
    if not all(math.isfinite(value) for value in [left, right, top, bottom, low, high]) or not (0 <= left < right < rgb.width and 0 <= top < bottom < rgb.height and low < high):
        raise ValueError('finite ordered pixel/value calibration inside image required')
    if color not in ['GREEN', 'BLUE']:
        raise ValueError('one explicitly identified source series color required')
    excluded = calibration.get('exclude_rects', [])
    rows = []
    for phase in angles:
        phase = float(phase)
        if not math.isfinite(phase) or not 0 <= phase <= 360:
            raise ValueError('phase must remain in the recorded 0..360 degree cycle')
        x = round(left + phase * (right - left) / 360)
        ys = []
        for y in range(math.ceil(top), math.floor(bottom) + 1):
            if any(x0 <= x <= x1 and y0 <= y <= y1 for x0, y0, x1, y1 in excluded):
                continue
            r, g, b = rgb.getpixel((x, y))
            matches = g - r >= 8 and g - b >= 18 if color == 'GREEN' else b - r >= 25 and g - r >= 12 and b - g >= 5
            if matches:
                ys.append(y)
        runs = []
        for y in ys:
            if not runs or y - runs[-1][-1] > 2:
                runs.append([y])
            else:
                runs[-1].append(y)
        candidates = []
        for run in runs:
            if run[-1] - run[0] <= 40:
                center = (run[0] + run[-1]) / 2
                value = high - (center - top) * (high - low) / (bottom - top)
                candidates.append({'pixel_y': center, 'value': value, 'pixel_from': run[0], 'pixel_through': run[-1],
                                   'support_pixels': len(run)})
        rows.append({'phase_degrees': phase, 'pixel_x': x,
                     'status': 'VISIBLE' if len(candidates) == 1 else 'AMBIGUOUS' if candidates else 'MISSING_OR_OCCLUDED',
                     'value': candidates[0]['value'] if len(candidates) == 1 else None, 'candidates': candidates})
    return rows


PDF_SHA256 = '8ce3d9204096e148aac58373b6fabb17194ff5a6f06e6ee5c9ad766fd9cc58b8'
LBF_TO_NEWTON = 4.4482216152605
CALIBRATION = {'left': 122, 'right': 746, 'top': 57, 'bottom': 457, 'value_min': -.23149, 'value_max': .23148,
               'exclude_rects': [(541, 70, 650, 136)]}
sha = lambda value: hashlib.sha256(value).hexdigest()


def derived_plot(record, path):
    from reportlab.pdfgen import canvas
    doc = canvas.Canvas(str(path), pagesize=(760, 460))
    doc.setTitle('Digitized filtered phase-average forces; physical application pending')
    doc.setFont('Helvetica', 13)
    doc.drawString(35, 430, 'Digitized phase-average force: two-seam, 50 rpm, reported 70 mph')
    doc.setFont('Helvetica', 9)
    doc.drawString(35, 412, 'The plotted offsets are retained; the lateral total offset is not established for this figure.')
    x0, y0, width, height = 66, 90, 648, 285
    low, high = -.24, .24
    doc.setFont('Helvetica', 8)
    doc.setStrokeColorRGB(.8, .8, .8)
    for angle in range(0, 361, 30):
        x = x0 + angle / 360 * width
        doc.line(x, y0, x, y0 + height)
        doc.drawCentredString(x, y0 - 13, str(angle))
    for step in range(-4, 5):
        value = step * .06
        y = y0 + (value - low) / (high - low) * height
        doc.line(x0, y, x0 + width, y)
        doc.drawRightString(x0 - 5, y - 3, f'{value:.2f}')
    for series in record['series']:
        color = (.35, .55, .13) if series['series'] == 'LIFT' else (.13, .37, .57)
        doc.setStrokeColorRGB(*color)
        doc.setFillColorRGB(*color)
        doc.setLineWidth(.8)
        previous = None
        for row in series['points']:
            x = x0 + row['phase_degrees'] / 360 * width
            if row['value'] is None:
                doc.circle(x, y0 - 2, .8, stroke=0, fill=1)
                previous = None
                continue
            y = y0 + (row['value'] - low) / (high - low) * height
            if previous is not None:
                doc.line(previous[0], previous[1], x, y)
            previous = (x, y)
        doc.setFont('Helvetica', 9)
        doc.drawString(80 if series['series'] == 'LIFT' else 390, 388,
                       'Green: lift' if series['series'] == 'LIFT' else 'Blue: lateral (DC uncertainty retained)')
    doc.setFillColorRGB(.12, .12, .12)
    doc.setFont('Helvetica', 10)
    doc.drawCentredString(x0 + width / 2, 58, 'Displayed azimuth angle (degrees); not free-flight elapsed time')
    doc.saveState()
    doc.translate(18, 220)
    doc.rotate(90)
    doc.drawCentredString(0, 0, 'Force (lbf), not dynamic-pressure-normalized CL')
    doc.restoreState()
    doc.setFont('Helvetica', 8)
    doc.drawString(35, 30, 'Derived from Morrissey thesis, printed p.86 Fig.3-24 / PDF p.109. Source image is not reproduced.')
    doc.drawString(35, 17, 'No zero filling, baseline subtraction, periodic closure, or world force-model adoption.')
    doc.showPage()
    doc.save()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--pdf', required=True)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()
    pdf, out = Path(args.pdf), Path(args.out)
    data = pdf.read_bytes()
    if sha(data) != PDF_SHA256:
        raise ValueError('source thesis bytes must match the reviewed version')
    out.mkdir(parents=True, exist_ok=False)
    from pypdf import PdfReader
    reader = PdfReader(pdf)
    image_file = next(image for image in reader.pages[108].images if image.name.split('.')[0] == 'Image369')
    image = image_file.image
    if image.size != (834, 522):
        raise ValueError('the reviewed force figure must match its original raster dimensions')
    phases = [(x - CALIBRATION['left']) / (CALIBRATION['right'] - CALIBRATION['left']) * 360
              for x in range(CALIBRATION['left'], CALIBRATION['right'] + 1)]
    series = []
    for label, color in [('LIFT', 'GREEN'), ('LATERAL', 'BLUE')]:
        calibration = {**CALIBRATION, 'series_color': color}
        points = digitize_color_columns(image, calibration, phases)
        for point in points:
            point['force_newtons'] = None if point['value'] is None else point['value'] * LBF_TO_NEWTON
        endpoints = [points[0]['value'], points[-1]['value']]
        series.append({'series': label, 'color': color, 'quantity': 'FORCE', 'unit': 'lbf', 'calibration': calibration,
                       'points': points, 'statusCounts': {status: sum(point['status'] == status for point in points)
                           for status in ['VISIBLE', 'MISSING_OR_OCCLUDED', 'AMBIGUOUS']},
                       'dcStatus': 'NOT_SUBTRACTED_IN_PUBLISHED_PROCESSING_CODE' if label == 'LIFT' else 'SUBTRACTED_IN_PUBLISHED_CODE_FIGURE_BATCH_NOT_CONFIRMED',
                       'periodicClosureApplied': False, 'endpointDifferenceLbf': None if None in endpoints else endpoints[1] - endpoints[0]})
    record = {'version': 'morrissey_phase_digitization_v157', 'sourceUrl': 'https://baseball.physics.illinois.edu/KBall/MorrisseyThesis.pdf',
              'sourcePdfSha256': sha(data), 'sourcePdfBytes': len(data), 'sourcePdfPageIndex': 108, 'sourceFolio': 86,
              'sourceFigure': '3-24', 'embeddedImageName': image_file.name, 'embeddedImageSha256': sha(image_file.data),
              'embeddedImageSize': list(image.size), 'readerScriptSha256': sha(Path(__file__).read_bytes()),
              'qaStatus': 'DERIVED_PIXEL_READINGS_REQUIRE_SOURCE_REVIEW', 'modelUseAllowed': False, 'nativeAdmission': False,
              'dataMeaning': 'FILTERED_AVERAGED_WIND_TUNNEL_FORCE_NOT_RAW_FORCE_OR_FREE_FLIGHT_TRACE',
              'measurementReported': {'rpm': 50, 'speedMph': 70, 'pattern': '2S'},
              'leftAxisAsPrinted': 'Force (lbs)', 'rightAxisAsPrinted': 'F_L / W_B',
              'leftAxisInterpretation': 'POUND_FORCE_FORCE_BALANCE_CONTEXT', 'lbfToNewtons': LBF_TO_NEWTON,
              'dynamicPressureLiftCoefficient': None, 'worldSignedSpinMapping': None, 'fullMaterialQuaternionBasis': None,
              'exactProcessingBatchForFigureConfirmed': False,
              'timeAxisMeaning': 'CYCLE_PHASE_AT_50_RPM_NOT_A_FREE_FLIGHT_TRACE',
              'readingUncertainty': {'phasePixels': 2, 'forceCenterPixels': 4,
                  'phaseDegreesPixelBound': 2 / (CALIBRATION['right'] - CALIBRATION['left']) * 360,
                  'forceLbfPixelBound': 4 / (CALIBRATION['bottom'] - CALIBRATION['top']) * (CALIBRATION['value_max'] - CALIBRATION['value_min']),
                  'instrumentVarianceIncluded': False, 'isStatisticalConfidenceInterval': False, 'pixelToleranceIsOperationalNotProved': True},
              'missingValuesImputed': False, 'series': series}
    with (out / 'digitized-forces.json').open('x', encoding='utf8') as target:
        json.dump(record, target, ensure_ascii=False, indent=2)
        target.write('\n')
    with (out / 'digitized-forces.csv').open('x', encoding='utf8', newline='') as target:
        writer = csv.DictWriter(target, fieldnames=['series', 'phase_degrees', 'force_lbf', 'force_newtons', 'status', 'candidate_count'])
        writer.writeheader()
        for channel in series:
            for point in channel['points']:
                writer.writerow({'series': channel['series'], 'phase_degrees': point['phase_degrees'], 'force_lbf': point['value'],
                                 'force_newtons': point['force_newtons'], 'status': point['status'], 'candidate_count': len(point['candidates'])})
    derived_plot(record, out / 'digitized-force-qa.pdf')
    if sha(pdf.read_bytes()) != PDF_SHA256:
        raise ValueError('source thesis changed during reading')
    print(json.dumps({'complete': True, 'sourcePdfSha256': PDF_SHA256, 'quantity': 'FORCE_LBF_NOT_CL',
                      'statuses': [{'series': item['series'], 'counts': item['statusCounts']} for item in series],
                      'modelUseAllowed': False}))


if __name__ == '__main__':
    main()
