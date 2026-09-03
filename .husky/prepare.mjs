if (
	'production' === process.env['NODE_ENV'] ||
	'true' === process.env['npm_config_production'] ||
	process.env['npm_config_omit']?.split(',').includes('dev')
) {
	process.exit(0);
}

const { default: husky } = await import('husky');

husky();
