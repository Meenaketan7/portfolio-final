import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const source = fileURLToPath(new URL('../../scripts/create-api.ts', import.meta.url));
let fixtureRoot: string;
let script: string;

beforeEach(async () => {
	fixtureRoot = await mkdtemp(resolve(tmpdir(), 'portfolio-create-api-'));
	await mkdir(resolve(fixtureRoot, 'scripts'));
	await mkdir(resolve(fixtureRoot, 'src/lib/hooks/api'), { recursive: true });
	script = resolve(fixtureRoot, 'scripts/create-api.ts');
	await copyFile(source, script);
});

afterEach(async () => {
	await rm(fixtureRoot, { recursive: true, force: true });
});

function runGenerator(...args: string[]) {
	return spawnSync('bun', [script, ...args], { encoding: 'utf8' });
}

describe('create-api script', () => {
	it('creates a named service with its expected files', async () => {
		const result = runGenerator('admin-panel');
		const target = resolve(fixtureRoot, 'src/lib/hooks/api/admin-panel');

		expect(result.status).toBe(0);
		expect((await readdir(target)).sort()).toEqual([
			'index.ts',
			'mutation.ts',
			'query.ts',
			'type.ts'
		]);
		expect(await readFile(resolve(target, 'type.ts'), 'utf8')).toContain(
			"export const adminPanelPath = '/admin-panel'"
		);
	});

	it('rejects invalid names before creating a folder', async () => {
		const result = runGenerator('AdminPanel');

		expect(result.status).toBe(1);
		expect(result.stderr).toContain('lowercase-kebab-name');
		expect(await readdir(resolve(fixtureRoot, 'src/lib/hooks/api'))).toEqual([]);
	});

	it('does not overwrite an existing service', async () => {
		const target = resolve(fixtureRoot, 'src/lib/hooks/api/user');
		await mkdir(target);
		await writeFile(resolve(target, 'type.ts'), 'existing content');

		const result = runGenerator('user');

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("API service 'user' already exists");
		expect(await readFile(resolve(target, 'type.ts'), 'utf8')).toBe('existing content');
	});
});
