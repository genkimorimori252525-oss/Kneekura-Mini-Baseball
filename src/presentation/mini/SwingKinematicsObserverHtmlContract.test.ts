import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createCompactSwingKinematicsObserverFixtureV1,
} from './SwingKinematicsObserverFixtureV1';

const htmlPath = resolve(
  process.cwd(),
  'docs/presentation/swing-kinematics-v1-core-observer.html',
);

const fixturePath = resolve(
  process.cwd(),
  'docs/presentation/fixtures/swing-kinematics-observer-compact-v1.b64',
);

const extractEmbeddedFixture = (
  html: string,
): string => {
  const match = html.match(
    /<script id="fixture" type="application\/octet-stream">([A-Za-z0-9+/=]+)<\/script>/,
  );
  if (match === null) {
    throw new Error(
      'swing observer HTML is missing embedded compact fixture',
    );
  }
  return match[1]!;
};

describe('swing kinematics v1 observer HTML contract', () => {
  it('embeds the exact compact Core-generated fixture rather than a second swing generator', () => {
    const html =
      readFileSync(
        htmlPath,
        'utf8',
      );
    const embedded =
      extractEmbeddedFixture(html);
    const expectedJson =
      JSON.stringify(
        createCompactSwingKinematicsObserverFixtureV1(),
      );
    const decodedJson =
      Buffer.from(
        embedded,
        'base64',
      ).toString('utf8');

    /**
     * Compare the serialized Core artifact byte-for-byte.
     * JSON intentionally canonicalizes JavaScript -0 to 0; comparing parsed
     * objects would therefore reject a correct snapshot only because Object.is
     * distinguishes signed zero.
     */
    expect(decodedJson).toBe(expectedJson);
    expect(html)
      .toContain(
        'data-observer-contract="v16"',
      );
    expect(html)
      .toContain(
        'data-physics-source="core-generated-swing-kinematics-v1"',
      );
    expect(html)
      .not.toContain(
        'planCourseAwareSwingKinematicsV1',
      );
    expect(html)
      .not.toContain(
        'sampleSwingKinematicsV1',
      );
  });

  it('keeps the standalone fixture artifact byte-identical to the HTML payload', () => {
    const html =
      readFileSync(
        htmlPath,
        'utf8',
      );
    const embedded =
      extractEmbeddedFixture(html);
    const artifact =
      readFileSync(
        fixturePath,
        'utf8',
      ).trim();

    expect(artifact).toBe(embedded);
  });

  it('declares the v16 spatial and temporal observation contract', () => {
    const html =
      readFileSync(
        htmlPath,
        'utf8',
      );

    expect(html).toContain(
      'MINI 4px / 55ms',
    );
    expect(html).toContain(
      '150×108',
    );
    expect(html).toContain(
      '物理を生成しない',
    );
    expect(html).toContain(
      '投手目線B1',
    );
  });
});