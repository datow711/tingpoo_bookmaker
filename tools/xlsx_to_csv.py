"""Export the 24 student rows from the supplied XLSX; Python standard library only."""
import argparse
import csv
from pathlib import Path
import posixpath
import zipfile
import xml.etree.ElementTree as ET

NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
PKG = 'http://schemas.openxmlformats.org/package/2006/relationships'

def convert(source, destination):
    with zipfile.ZipFile(source) as archive:
        workbook = ET.fromstring(archive.read('xl/workbook.xml'))
        sheet = next((s for s in workbook.findall('s:sheets/s:sheet', NS)
                      if s.get('name') == '逐題填答'), None)
        if sheet is None:
            raise ValueError('找不到「逐題填答」工作表。')
        relations = ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))
        target = next(r.get('Target') for r in relations.findall(f'{{{PKG}}}Relationship')
                      if r.get('Id') == sheet.get(f'{{{REL}}}id'))
        target = target.lstrip('/') if target.startswith('/') else posixpath.normpath(posixpath.join('xl', target))
        shared = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            root = ET.fromstring(archive.read('xl/sharedStrings.xml'))
            shared = [''.join(t.text or '' for t in s.findall('.//s:t', NS)) for s in root.findall('s:si', NS)]
        sheet_xml = ET.fromstring(archive.read(target))
        rows = []
        for row in sheet_xml.findall('s:sheetData/s:row', NS):
            values = [''] * 20
            for cell in row.findall('s:c', NS):
                column = ''.join(c for c in cell.get('r') if c.isalpha())
                index = 0
                for character in column:
                    index = index * 26 + ord(character) - 64
                if index > 20:
                    continue
                value = cell.find('s:v', NS)
                text = value.text or '' if value is not None else ''
                if cell.get('t') == 's':
                    text = shared[int(text)]
                elif cell.get('t') == 'inlineStr':
                    text = ''.join(t.text or '' for t in cell.findall('.//s:t', NS))
                values[index - 1] = text
            rows.append(values)
    header_index = next((i for i, r in enumerate(rows) if r[:2] == ['座號', '姓名']), None)
    if header_index is None:
        raise ValueError('找不到「座號、姓名」標題列。')
    headers = rows[header_index]
    students = [r for r in rows[header_index + 1:] if r[0].strip()]
    if len(students) != 24 or {int(r[0]) for r in students} != set(range(3, 27)):
        raise ValueError('需要 3～26 號共 24 位學生，且座號不得重複。')
    if any(not r[1].strip() for r in students):
        raise ValueError('學生姓名不得空白。')
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open('w', encoding='utf-8-sig', newline='') as output:
        writer = csv.writer(output)
        writer.writerow(headers)
        writer.writerows(sorted(students, key=lambda r: int(r[0])))
    print(f'已匯出 24 位學生：{destination}')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='將頂埔學習單 XLSX 匯出為展示頁使用的 CSV。')
    parser.add_argument('xlsx', type=Path)
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parent.parent / 'data/answers.csv')
    arguments = parser.parse_args()
    try:
        convert(arguments.xlsx, arguments.output)
    except (ValueError, KeyError, zipfile.BadZipFile, OSError) as error:
        parser.exit(1, f'匯出失敗：{error}\n')
