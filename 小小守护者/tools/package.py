"""Package only the generated H5 root; never include developer credentials or source."""
import pathlib
import sys
import zipfile

root = pathlib.Path(sys.argv[1]).resolve()
target = pathlib.Path(sys.argv[2]).resolve()
if root.name != 'dist' or not (root / 'index.html').is_file():
    raise RuntimeError('Expected a generated dist with index.html')
files = sorted(p for p in root.rglob('*') if p.is_file())
with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for item in files:
        if item.is_symlink() or root not in item.resolve().parents:
            raise RuntimeError('Unexpected external resource')
        archive.write(item, 'little-guardians/' + item.relative_to(root).as_posix())
with zipfile.ZipFile(target) as archive:
    if archive.testzip() or 'little-guardians/index.html' not in archive.namelist():
        raise RuntimeError('Package validation failed')
print(f'Root H5 entry and {len(files)} files verified.')
