"""Synthetic pixel fixtures only, not source-figure data or physical-force validation."""

from copy import deepcopy
import math
import unittest

from PIL import Image, ImageDraw

from digitize_borg_phase_v157 import digitize_columns


class DigitizeColumnsSyntheticTests(unittest.TestCase):
    def setUp(self):
        self.calibration = {
            "left": 30,
            "right": 330,
            "top": 20,
            "bottom": 180,
            "cl_min": -0.2,
            "cl_max": 0.2,
            "exclude_rects": [(225, 28, 320, 66)],
        }
        self.angles = [30.0, 60.0, 120.0, 150.0, 210.0, 240.0, 300.0, 330.0]
        self.coefficient_per_pixel = (
            self.calibration["cl_max"] - self.calibration["cl_min"]
        ) / (self.calibration["bottom"] - self.calibration["top"])

    def column(self, phase):
        return round(
            self.calibration["left"]
            + phase / 360.0 * (self.calibration["right"] - self.calibration["left"])
        )

    @staticmethod
    def mean_pixel_y(phase):
        return round(100 + 22 * math.sin(math.radians(phase)))

    def coefficient(self, pixel_y):
        return self.calibration["cl_max"] - (
            pixel_y - self.calibration["top"]
        ) * self.coefficient_per_pixel

    def synthetic_plot(self):
        image = Image.new("RGB", (360, 200), (255, 255, 255))
        draw = ImageDraw.Draw(image)
        draw.rectangle((30, 20, 330, 180), outline=(0, 0, 0), width=1)
        for x in (105, 180, 255):
            draw.line((x, 20, x, 180), fill=(0, 0, 0), width=1)
        draw.line((30, 150, 330, 150), fill=(0, 0, 0), width=2)
        mean = [
            (x, self.mean_pixel_y((x - 30) / 300.0 * 360.0))
            for x in range(30, 331)
        ]
        draw.line(mean, fill=(150, 150, 150), width=3)
        # The legend has the same gray as the mean; it is excluded by geometry.
        draw.rectangle((225, 28, 320, 66), fill=(255, 255, 255))
        draw.line((230, 45, 315, 45), fill=(150, 150, 150), width=3)
        return image

    def read_without_mutation(self, image, angles):
        image_before = image.tobytes()
        calibration_before = deepcopy(self.calibration)
        rows = digitize_columns(image, self.calibration, (float(angle) for angle in angles))
        self.assertEqual(image.tobytes(), image_before)
        self.assertEqual(self.calibration, calibration_before)
        self.assertEqual(len(rows), len(angles))
        return {row["phase_degrees"]: row for row in rows}

    def assert_visible_mean(self, rows):
        for phase in self.angles:
            with self.subTest(phase=phase):
                row = rows[phase]
                expected_y = self.mean_pixel_y(phase)
                self.assertEqual(row["status"], "VISIBLE")
                self.assertIsNotNone(row["coefficient"])
                self.assertAlmostEqual(
                    row["coefficient"],
                    self.coefficient(expected_y),
                    delta=2 * self.coefficient_per_pixel + 1e-12,
                )
                self.assertEqual(len(row["candidates"]), 1)
                candidate = row["candidates"][0]
                self.assertAlmostEqual(candidate["pixel_y"], expected_y, delta=2)
                self.assertAlmostEqual(
                    candidate["coefficient"],
                    self.coefficient(expected_y),
                    delta=2 * self.coefficient_per_pixel + 1e-12,
                )

    def test_reads_only_gray_mean_with_black_static_grid_and_excluded_legend(self):
        rows = self.read_without_mutation(self.synthetic_plot(), self.angles)
        self.assert_visible_mean(rows)

    def test_recovers_same_gray_mean_under_translucent_blue_overlay_within_two_pixels(self):
        original = self.synthetic_plot()
        # Uniform alpha compositing tints background, black reference and mean together.
        # This tests color normalization; it adds no source-figure or force assumption.
        overlay = Image.new("RGBA", original.size, (80, 150, 240, 72))
        tinted = Image.alpha_composite(original.convert("RGBA"), overlay).convert("RGB")
        original_rows = self.read_without_mutation(original, self.angles)
        tinted_rows = self.read_without_mutation(tinted, self.angles)
        self.assert_visible_mean(tinted_rows)
        for phase in self.angles:
            self.assertAlmostEqual(
                tinted_rows[phase]["coefficient"],
                original_rows[phase]["coefficient"],
                delta=2 * self.coefficient_per_pixel + 1e-12,
            )

    def test_keeps_black_occlusion_missing_and_two_visible_gray_runs_ambiguous(self):
        image = self.synthetic_plot()
        draw = ImageDraw.Draw(image)
        occluded_phase, ambiguous_phase = 150.0, 30.0
        x, y = self.column(occluded_phase), self.mean_pixel_y(occluded_phase)
        draw.rectangle((x - 2, y - 6, x + 2, y + 6), fill=(0, 0, 0))
        other_x = self.column(ambiguous_phase)
        draw.line((other_x - 5, 60, other_x + 5, 60), fill=(150, 150, 150), width=3)
        rows = self.read_without_mutation(image, [occluded_phase, ambiguous_phase])
        missing = rows[occluded_phase]
        self.assertEqual(missing["status"], "MISSING_OR_OCCLUDED")
        self.assertIsNone(missing["coefficient"])
        self.assertIsInstance(missing["candidates"], list)
        ambiguous = rows[ambiguous_phase]
        self.assertEqual(ambiguous["status"], "AMBIGUOUS")
        self.assertIsNone(ambiguous["coefficient"])
        self.assertGreaterEqual(len(ambiguous["candidates"]), 2)
        for expected_y in (60, self.mean_pixel_y(ambiguous_phase)):
            self.assertTrue(
                any(abs(candidate["pixel_y"] - expected_y) <= 2 for candidate in ambiguous["candidates"])
            )


if __name__ == "__main__":
    unittest.main(verbosity=2)
