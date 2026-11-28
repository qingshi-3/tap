#!/usr/bin/env python3
"""Validate or update the Git library's default grades from an explicit export."""

import argparse
import json
import shutil
import sys
from pathlib import Path
from tempfile import TemporaryDirectory


DEFAULT_LIBRARY = Path(__file__).resolve().parents[1] / "assets/duelyst-library"
CLEAR_GRADE = "待设置"
JS_PREFIX = "globalThis.DUELYST_DATA="
GRADE_LIST = "单位分级清单-全量.json"
UNIT_INDEX = "单位/index.json"
H5_DATA = "H5/data.js"


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"重复字段 {key!r}")
        result[key] = value
    return result


def reject_constant(value):
    raise ValueError(f"无效 JSON 值 {value}")


def parse_json(path, content):
    try:
        return json.loads(content, object_pairs_hook=unique_object,
                          parse_constant=reject_constant)
    except ValueError as error:
        raise ValueError(f"{path}: {error}") from error


def grade_rows(rows, label, *, filename_schema=False):
    if not isinstance(rows, list) or not rows:
        raise ValueError(f"{label}: 需要非空的单位数组")
    id_key, grade_key = ("文件名", "分档") if filename_schema else ("id", "grade")
    by_id = {}
    for position, row in enumerate(rows, 1):
        where = f"{label} 第 {position} 条"
        if not isinstance(row, dict) or id_key not in row or grade_key not in row:
            raise ValueError(f"{where}: 缺少 {id_key} 或 {grade_key}")
        unit_id = row[id_key]
        if not isinstance(unit_id, str) or not unit_id:
            raise ValueError(f"{where}: 无效的 {id_key}")
        if filename_schema:
            if not unit_id.endswith(".png") or unit_id == ".png":
                raise ValueError(f"{where}: 文件名必须是单位 ID 加 .png")
            unit_id = unit_id[:-4]
        if unit_id in by_id:
            raise ValueError(f"{where}: 重复 ID {unit_id!r}")
        grade = row[grade_key]
        unset = CLEAR_GRADE if filename_schema else None
        if grade == unset:
            grade = None
        elif type(grade) is not int or not 1 <= grade <= 5:
            raise ValueError(f"{where}: {unit_id!r} 的档位无效 {grade!r}")
        by_id[unit_id] = (row, grade)
    return by_id


def sample(ids):
    return "、".join(sorted(ids)[:8])


def check_ids(expected, actual, label):
    unknown = actual.keys() - expected.keys()
    missing = expected.keys() - actual.keys()
    if unknown or missing:
        problems = []
        if unknown:
            problems.append(f"未知 ID {len(unknown)} 个（{sample(unknown)}）")
        if missing:
            problems.append(f"缺少 ID {len(missing)} 个（{sample(missing)}）")
        raise ValueError(f"{label}: " + "；".join(problems))


def write_updates(library, originals, updates):
    # Prepare all replacements and rollback copies before touching any target.
    with TemporaryDirectory(prefix=".duelyst-grades-", dir=library) as temporary:
        staging = Path(temporary)
        for number, (path, content) in enumerate(updates.items()):
            replacement = staging / f"new-{number}"
            backup = staging / f"old-{number}"
            replacement.write_bytes(content)
            backup.write_bytes(originals[path])
            shutil.copymode(path, replacement)
            shutil.copymode(path, backup)
        for path, content in originals.items():
            if path.read_bytes() != content:
                raise ValueError(f"{path}: 校验后文件发生变化，请重试")

        replaced = []
        try:
            for number, path in enumerate(updates):
                (staging / f"new-{number}").replace(path)
                replaced.append((number, path))
        except OSError:
            for number, path in reversed(replaced):
                (staging / f"old-{number}").replace(path)
            raise


def sync_grades(library, export):
    list_path, index_path, js_path = (library / name for name in (GRADE_LIST, UNIT_INDEX, H5_DATA))
    originals = {path: path.read_bytes() for path in (list_path, index_path, js_path)}
    grades = parse_json(list_path, originals[list_path])
    units = parse_json(index_path, originals[index_path])
    js = originals[js_path].decode("utf-8")
    if not js.startswith(JS_PREFIX) or not js.rstrip().endswith(";"):
        raise ValueError(f"{js_path}: 缺少 DUELYST_DATA 的 JSON 赋值")
    end = js.rfind(";")
    data = parse_json(js_path, js[len(JS_PREFIX):end])
    try:
        h5_units = data["assets"]["unit"]
    except (KeyError, TypeError) as error:
        raise ValueError(f"{js_path}: 缺少 assets.unit 数组") from error

    defaults = grade_rows(grades, GRADE_LIST, filename_schema=True)
    indexed = grade_rows(units, UNIT_INDEX)
    embedded = grade_rows(h5_units, H5_DATA)
    for label, rows in ((UNIT_INDEX, indexed), (H5_DATA, embedded)):
        check_ids(defaults, rows, label)
        mismatched = [unit_id for unit_id, (_, grade) in defaults.items()
                      if rows[unit_id][1] != grade]
        if mismatched:
            raise ValueError(f"{label}: 与 {GRADE_LIST} 有 {len(mismatched)} 个档位不一致"
                             f"（{sample(mismatched)}）")

    if export is None:
        print(f"通过：三份默认档位均一致，共 {len(defaults)} 个单位。")
        return

    selected = grade_rows(parse_json(export, export.read_bytes()), export, filename_schema=True)
    check_ids(defaults, selected, export)
    changed = 0
    for unit_id, (_, grade) in selected.items():
        if defaults[unit_id][1] == grade:
            continue
        defaults[unit_id][0]["分档"] = CLEAR_GRADE if grade is None else grade
        indexed[unit_id][0]["grade"] = grade
        embedded[unit_id][0]["grade"] = grade
        changed += 1
    if not changed:
        print(f"无需更新：{len(defaults)} 个单位的默认档位已与导出一致。")
        return

    updated_js = JS_PREFIX + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + js[end:]
    updates = {
        list_path: (json.dumps(grades, ensure_ascii=False, indent=2) + "\n").encode("utf-8"),
        index_path: (json.dumps(units, ensure_ascii=False, indent=2) + "\n").encode("utf-8"),
        js_path: updated_js.encode("utf-8"),
    }
    write_updates(library, originals, updates)
    print(f"已更新 {changed}/{len(defaults)} 个单位的默认档位（三份文件）。")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--check", action="store_true", help="校验三份默认档位（默认）")
    modes.add_argument("--apply", type=Path, metavar="PATH", help="应用阅览台全量导出的分档 JSON")
    parser.add_argument("--library", type=Path, default=DEFAULT_LIBRARY, metavar="PATH",
                        help="指定资料库目录，例如临时测试副本")
    args = parser.parse_args()
    try:
        sync_grades(args.library, args.apply)
    except (OSError, ValueError) as error:
        print(f"分档处理失败：{error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
