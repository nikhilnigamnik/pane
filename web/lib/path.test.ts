import { describe, expect, it } from 'vitest';

import { fileExtension, fileName, parentPath, resolveRelativePath } from './path';

describe('path parts', () => {
  it('splits a path into folder and name', () => {
    expect(fileName('web/lib/path.ts')).toBe('path.ts');
    expect(parentPath('web/lib/path.ts')).toBe('web/lib');
    expect(parentPath('readme.md')).toBe('');
  });

  it('reads the extension in lower case', () => {
    expect(fileExtension('docs/Guide.MD')).toBe('.md');
    expect(fileExtension('archive.tar.gz')).toBe('.gz');
    expect(fileExtension('Makefile')).toBe('');
    expect(fileExtension('.gitignore')).toBe('');
    expect(fileExtension('some.folder/file')).toBe('');
  });
});

describe('resolveRelativePath', () => {
  it('resolves links against the folder of the file that holds them', () => {
    expect(resolveRelativePath('docs/guide.md', 'setup.md')).toBe('docs/setup.md');
    expect(resolveRelativePath('docs/guide.md', './images/a.png')).toBe('docs/images/a.png');
    expect(resolveRelativePath('docs/guide.md', '../readme.md')).toBe('readme.md');
    expect(resolveRelativePath('readme.md', 'docs/guide.md')).toBe('docs/guide.md');
  });

  it('treats a leading slash as the opened folder', () => {
    expect(resolveRelativePath('docs/deep/guide.md', '/src/index.ts')).toBe('src/index.ts');
  });

  it('drops the query and fragment and decodes escapes', () => {
    expect(resolveRelativePath('readme.md', 'docs/setup.md#install')).toBe('docs/setup.md');
    expect(resolveRelativePath('readme.md', 'logo.png?raw=true')).toBe('logo.png');
    expect(resolveRelativePath('readme.md', 'my%20notes.md')).toBe('my notes.md');
  });

  it('returns null when there is no file to open', () => {
    expect(resolveRelativePath('readme.md', '#section')).toBeNull();
    expect(resolveRelativePath('readme.md', '')).toBeNull();
    expect(resolveRelativePath('readme.md', './')).toBeNull();
    expect(resolveRelativePath('readme.md', '%E0%A4%A')).toBeNull();
  });

  it('returns null for links that climb above the opened folder', () => {
    expect(resolveRelativePath('readme.md', '../secret.txt')).toBeNull();
    expect(resolveRelativePath('docs/guide.md', '../../secret.txt')).toBeNull();
    expect(resolveRelativePath('docs/guide.md', '/../secret.txt')).toBeNull();
    expect(resolveRelativePath('docs/guide.md', '%2E%2E/%2E%2E/secret.txt')).toBeNull();
  });
});
