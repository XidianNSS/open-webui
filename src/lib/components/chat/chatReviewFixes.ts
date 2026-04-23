type ModelLike = {
	id?: string;
	info?: {
		meta?: {
			collab_enabled?: boolean;
		};
	};
};

type FileLike = {
	name?: string;
	url?: string;
};

type GoogleDriveFileData = {
	id?: string;
	name?: string;
	url?: string;
	headers?: {
		Authorization?: string;
	};
};

export const normalizeSelectedModels = (models: string[] | string | null | undefined): string[] => {
	if (Array.isArray(models)) {
		return models;
	}

	if (typeof models === 'string') {
		return [models];
	}

	return [''];
};

export const isEdgeCloudModelEnabled = (models: ModelLike[], modelId = ''): boolean => {
	if (!modelId) {
		return false;
	}

	const model = models.find((item) => item.id === modelId);
	if (!model) {
		return false;
	}

	return model.info?.meta?.collab_enabled !== false;
};

export const filterFilesAfterUploadWebError = <T extends FileLike>(
	files: T[],
	failedFileItem: FileLike
): T[] => {
	return files.filter((file) => file !== failedFileItem);
};

export const buildGoogleDriveUploadLogPayload = (fileData: GoogleDriveFileData) => ({
	id: fileData.id,
	name: fileData.name,
	url: fileData.url,
	headers: {
		Authorization: fileData.headers?.Authorization ? 'Bearer [REDACTED]' : undefined
	}
});
