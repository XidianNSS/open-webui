import { describe, expect, it } from 'vitest';

import {
	buildGoogleDriveUploadLogPayload,
	filterFilesAfterUploadWebError,
	isEdgeCloudModelEnabled,
	normalizeSelectedModels
} from './chatReviewFixes';

describe('normalizeSelectedModels', () => {
	it('keeps array payloads unchanged', () => {
		expect(normalizeSelectedModels(['model-a', 'model-b'])).toEqual(['model-a', 'model-b']);
	});

	it('wraps legacy string payloads into an array', () => {
		expect(normalizeSelectedModels('model-a')).toEqual(['model-a']);
	});

	it('falls back to an empty slot for missing payloads', () => {
		expect(normalizeSelectedModels(undefined)).toEqual(['']);
	});
});

describe('isEdgeCloudModelEnabled', () => {
	it('returns false when the model is missing', () => {
		expect(isEdgeCloudModelEnabled([], 'missing')).toBe(false);
	});

	it('preserves legacy behavior when collab metadata is missing', () => {
		expect(
			isEdgeCloudModelEnabled(
				[
					{
						id: 'model-a',
						info: {
							meta: {}
						}
					}
				],
				'model-a'
			)
		).toBe(true);
	});

	it('returns true only for models that explicitly enable collab', () => {
		expect(
			isEdgeCloudModelEnabled(
				[
					{
						id: 'model-a',
						info: {
							meta: {
								collab_enabled: true
							}
						}
					}
				],
				'model-a'
			)
		).toBe(true);
	});

	it('returns false when a model explicitly disables collab', () => {
		expect(
			isEdgeCloudModelEnabled(
				[
					{
						id: 'model-a',
						info: {
							meta: {
								collab_enabled: false
							}
						}
					}
				],
				'model-a'
			)
		).toBe(false);
	});
});

describe('filterFilesAfterUploadWebError', () => {
	it('removes only the failed file item', () => {
		const failedFileItem = { name: 'https://a.example', url: 'https://a.example' };
		const remaining = filterFilesAfterUploadWebError(
			[failedFileItem, { name: 'https://b.example', url: 'https://b.example' }],
			failedFileItem
		);

		expect(remaining).toEqual([{ name: 'https://b.example', url: 'https://b.example' }]);
	});
});

describe('buildGoogleDriveUploadLogPayload', () => {
	it('redacts the bearer token before logging', () => {
		expect(
			buildGoogleDriveUploadLogPayload({
				id: 'file-id',
				name: 'notes.txt',
				url: 'https://drive.example/file',
				headers: {
					Authorization: 'Bearer super-secret-token'
				}
			})
		).toEqual({
			id: 'file-id',
			name: 'notes.txt',
			url: 'https://drive.example/file',
			headers: {
				Authorization: 'Bearer [REDACTED]'
			}
		});
	});
});
