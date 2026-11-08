"""Synthetic color pixels only; not thesis figures, force data, or CL calibration."""

from copy import deepcopy
import math
import unittest

from PIL import Image, ImageDraw

from digitize_morrissey_phase_v157 import digitize_color_columns


class DigitizeColorColumnsSyntheticTests(unittest.TestCase):
    COLORS = {"GREEN": (40, 170, 70), "BLUE": (40, 95, 220)}

    def setUp(self):
        self.base_calibration = {
            "left": 23,
            "right": 323,
            "top": 17,
            "bottom": 177,
            "value_min": -0.7,
            "value_max": 1.3,
            "exclude_rects": [(232, 25, 320, 49)],
        }
        self.angles = [30.0, 60.0, 120.0, 150.0, 210.0, 240.0, 300.0, 330.0]

    def column(self, phase):
        return round(23 + phase / 360.0 * 300)

    @staticmethod
    def curve_y(series, phase):
        radians = math.radians(phase)
        return round(79 + 18 * math.sin(radians)) if series == "GREEN" else round(128 + 13 * math.cos(radians))

    @staticmethod
    def value_at(calibration, pixel_y):
        return calibration["value_max"] - (
            (pixel_y - calibration["top"])
            / (calibration["bottom"] - calibration["top"])
            * (calibration["value_max"] - calibration["value_min"])
        )

    @staticmethod
    def two_pixel_tolerance(calibration):
        return 2 * (calibration["value_max"] - calibration["value_min"]) / (
            calibration["bottom"] - calibration["top"]
        ) + 1e-12

    def synthetic_plot(self):
        image = Image.new("RGB", (350, 200), (255, 255, 255))
        draw = ImageDraw.Draw(image)
        draw.rectangle((23, 17, 323, 177), outline=(0, 0, 0), width=1)
        for x in (98, 173, 248):
            draw.line((x, 17, x, 177), fill=(0, 0, 0), width=1)
        for y in (52, 160):
            draw.line((23, y, 323, y), fill=(0, 0, 0), width=1)
        for series, color in self.COLORS.items():
            points = [(x, self.curve_y(series, (x - 23) / 300.0 * 360.0)) for x in range(23, 324)]
            draw.line(points, fill=color, width=3)
        # The legend repeats both real series colors and must be excluded.
        draw.rectangle((232, 25, 320, 49), fill=(255, 255, 255))
        draw.line((238, 33, 315, 33), fill=self.COLORS["GREEN"], width=3)
        draw.line((238, 42, 315, 42), fill=self.COLORS["BLUE"], width=3)
        return image

    def read_without_mutation(self, image, series, angles, bounds=None):
        calibration = {**deepcopy(self.base_calibration), "series_color": series}
        if bounds is not None:
            calibration["value_min"], calibration["value_max"] = bounds
        before_calibration, before_pixels = deepcopy(calibration), image.tobytes()
        rows = digitize_color_columns(image, calibration, (float(phase) for phase in angles))
        self.assertEqual(calibration, before_calibration)
        self.assertEqual(image.tobytes(), before_pixels)
        self.assertEqual(len(rows), len(angles))
        for row in rows:
            self.assertNotIn("coefficient", row)
            self.assertEqual(row["pixel_x"], self.column(row["phase_degrees"]))
            for candidate in row["candidates"]:
                self.assertNotIn("coefficient", candidate)
        return {row["phase_degrees"]: row for row in rows}, calibration

    def assert_visible(self, row, calibration, series, phase):
        self.assertEqual(row["status"], "VISIBLE")
        self.assertIsNotNone(row["value"])
        self.assertAlmostEqual(
            row["value"],
            self.value_at(calibration, self.curve_y(series, phase)),
            delta=self.two_pixel_tolerance(calibration),
        )
        self.assertEqual(len(row["candidates"]), 1)
        candidate = row["candidates"][0]
        self.assertAlmostEqual(candidate["pixel_y"], self.curve_y(series, phase), delta=2)
        self.assertAlmostEqual(candidate["value"], row["value"], delta=self.two_pixel_tolerance(calibration))

    def test_reads_each_color_independently_and_ignores_black_grid_and_colored_legend(self):
        image = self.synthetic_plot()
        for series in self.COLORS:
            rows, calibration = self.read_without_mutation(image, series, self.angles)
            for phase in self.angles:
                with self.subTest(series=series, phase=phase):
                    self.assert_visible(rows[phase], calibration, series, phase)

    def test_uses_arbitrary_non_symmetric_linear_bounds_without_assuming_zero_or_coefficient_units(self):
        image = self.synthetic_plot()
        for series in self.COLORS:
            rows, calibration = self.read_without_mutation(image, series, self.angles, bounds=(2.75, 9.5))
            for phase in self.angles:
                with self.subTest(series=series, phase=phase):
                    self.assert_visible(rows[phase], calibration, series, phase)
                    self.assertGreater(rows[phase]["value"], 2.75)
                    self.assertLess(rows[phase]["value"], 9.5)

    def test_preserves_black_occlusion_and_ambiguity_of_two_runs_of_the_requested_color(self):
        image = self.synthetic_plot()
        draw = ImageDraw.Draw(image)
        missing_phase, ambiguous_phase = 150.0, 30.0
        for series, second_y in (("GREEN", 63), ("BLUE", 108)):
            x, y = self.column(missing_phase), self.curve_y(series, missing_phase)
            draw.rectangle((x - 2, y - 6, x + 2, y + 6), fill=(0, 0, 0))
            other_x = self.column(ambiguous_phase)
            draw.line((other_x - 5, second_y, other_x + 5, second_y), fill=self.COLORS[series], width=3)
        for series, second_y in (("GREEN", 63), ("BLUE", 108)):
            rows, _ = self.read_without_mutation(image, series, [missing_phase, ambiguous_phase])
            with self.subTest(series=series):
                self.assertEqual(rows[missing_phase]["status"], "MISSING_OR_OCCLUDED")
                self.assertIsNone(rows[missing_phase]["value"])
                ambiguous = rows[ambiguous_phase]
                self.assertEqual(ambiguous["status"], "AMBIGUOUS")
                self.assertIsNone(ambiguous["value"])
                self.assertGreaterEqual(len(ambiguous["candidates"]), 2)
                for expected_y in (second_y, self.curve_y(series, ambiguous_phase)):
                    self.assertTrue(
                        any(abs(candidate["pixel_y"] - expected_y) <= 2 for candidate in ambiguous["candidates"])
                    )


if __name__ == "__main__":
    unittest.main(verbosity=2)
