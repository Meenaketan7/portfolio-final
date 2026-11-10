import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../src/lib/hooks/api');

function templates(name: string): Record<string, string> {
	const pascalName = name
		.split('-')
		.map((part) => part[0].toUpperCase() + part.slice(1))
		.join('');
	const camelName = pascalName[0].toLowerCase() + pascalName.slice(1);

	return {
		'type.ts': `// Change this path to match the Phoenix resource before making requests.
export const ${camelName}Path = '/${name}';
`,
		'query.ts': `import { queryOptions } from '@tanstack/svelte-query';
import { apiRequest } from '#config/api/request.js';
import { ${camelName}Path } from './type.js';

export const ${camelName}Keys = {
	all: ['${name}'] as const,
	list: () => ['${name}', 'list'] as const,
	detail: (id: string) => ['${name}', 'detail', id] as const
};

export const ${camelName}Queries = {
	list: <TResponse = unknown>(fetcher?: typeof fetch) =>
		queryOptions({
			queryKey: ${camelName}Keys.list(),
			queryFn: ({ signal }) => apiRequest<TResponse>(${camelName}Path, { fetcher, signal })
		}),
	detail: <TResponse = unknown>(id: string, fetcher?: typeof fetch) =>
		queryOptions({
			queryKey: ${camelName}Keys.detail(id),
			queryFn: ({ signal }) =>
				apiRequest<TResponse>(${camelName}Path + '/' + encodeURIComponent(id), { fetcher, signal })
		})
};
`,
		'mutation.ts': `import { mutationOptions } from '@tanstack/svelte-query';
import { apiRequest } from '#config/api/request.js';
import { ${camelName}Path } from './type.js';

export const ${camelName}Mutations = {
	create: <TResponse = unknown, TInput = unknown>(fetcher?: typeof fetch) =>
		mutationOptions({
			mutationFn: (data: TInput) =>
				apiRequest<TResponse>(${camelName}Path, { method: 'POST', data, fetcher })
		}),
	update: <TResponse = unknown, TInput = unknown>(fetcher?: typeof fetch) =>
		mutationOptions({
			mutationFn: ({ id, data }: { id: string; data: TInput }) =>
				apiRequest<TResponse>(${camelName}Path + '/' + encodeURIComponent(id), {
					method: 'PATCH',
					data,
					fetcher
				})
		}),
	remove: (fetcher?: typeof fetch) =>
		mutationOptions({
			mutationFn: (id: string) =>
				apiRequest<void>(${camelName}Path + '/' + encodeURIComponent(id), {
					method: 'DELETE',
					fetcher
				})
		})
};
`,
		'index.ts': `export * from './type.js';
export * from './query.js';
export * from './mutation.js';
`
	};
}

async function main(): Promise<void> {
	const [name, ...extra] = process.argv.slice(2);

	if (!name || extra.length > 0 || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name)) {
		throw new Error('Usage: bun run create-api <lowercase-kebab-name>');
	}

	const target = resolve(apiDirectory, name);

	try {
		await mkdir(target);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
			throw new Error(`API service '${name}' already exists`, { cause: error });
		}

		throw error;
	}

	try {
		for (const [file, content] of Object.entries(templates(name))) {
			await writeFile(resolve(target, file), content, { flag: 'wx' });
		}
	} catch (error) {
		await rm(target, { recursive: true, force: true });
		throw error;
	}

	process.stdout.write(`Created src/lib/hooks/api/${name}\n`);
}

main().catch((error: unknown) => {
	process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
	process.exitCode = 1;
});
