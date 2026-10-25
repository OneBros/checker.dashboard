import argparse
import collections
import datetime
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET
import zipfile

GAMES = [('Demons Souls', "Demon's Souls"), ('Dark Souls 1', 'Dark Souls 1'), ('Dark Souls 2', 'Dark Souls 2'), ('Dark Souls 3', 'Dark Souls 3'), ('Bloodborne', 'Bloodborne'), ('Sekiro', 'Sekiro'), ('Elden Ring', 'Elden Ring')]
HEADERS = ['Status', 'Checker', 'Claimed Date', 'Checked Date', 'Checker Notes', 'Runner', 'Link', 'Tier', 'Restrictions', 'Extra Restrictions', 'Days Since Submission', 'Team Hitless Verified?', 'Team Hitless Profile', 'Platform', 'Submission Timestamp']
NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


def import_snapshot(source, output):
    with zipfile.ZipFile(str(source)) as archive:
        workbook = ET.fromstring(archive.read('xl/workbook.xml'))
        strings = [''.join(item.itertext()) for item in ET.fromstring(archive.read('xl/sharedStrings.xml'))] if 'xl/sharedStrings.xml' in archive.namelist() else []
        relations = {item.get('Id'): item.get('Target') for item in ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))}
        sheets = {item.get('name'): relations[item.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')] for item in workbook.find('m:sheets', NS)}
        props = workbook.find('m:workbookPr', NS)
        epoch = datetime.datetime(1904, 1, 1) if props is not None and props.get('date1904') in ('1', 'true') else datetime.datetime(1899, 12, 30)
        runs, identifiers = [], set()
        for sheet, game in GAMES:
            target = sheets[sheet]
            root = ET.fromstring(archive.read(target.lstrip('/') if target.startswith('/') else 'xl/' + target))
            rows = []
            for row in root.findall('m:sheetData/m:row', NS):
                values = {}
                for cell in row:
                    col = ''.join(c for c in cell.get('r') if c.isalpha())
                    value = cell.find('m:v', NS)
                    value = value.text if value is not None else ''
                    if cell.get('t') == 's':
                        value = strings[int(value)] if value else ''
                    elif cell.get('t') == 'inlineStr':
                        value = ''.join(cell.find('m:is', NS).itertext())
                    if value:
                        values[col] = value
                rows.append(values)
            if [rows[0].get(chr(65+i), '') for i in range(15)] != HEADERS:
                raise ValueError('Unexpected worksheet schema: ' + sheet)
            for row in rows[1:]:
                if not any(row.get(c, '').strip() for c in ['A', 'B', 'F', 'G', 'H', 'O']):
                    continue
                if not row.get('F', '').strip():
                    raise ValueError('Submission without runner in ' + sheet)
                identity = [sheet, row.get('O', ''), row.get('F', ''), row.get('G', '')]
                identifier = hashlib.sha256(json.dumps(identity, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
                if identifier in identifiers:
                    raise ValueError('Ambiguous duplicate identity in ' + sheet + '; import stopped without replacing snapshot')
                identifiers.add(identifier)
                warnings = []
                def date_value(col):
                    value = row.get(col, '')
                    if not value:
                        return None
                    try:
                        return (epoch + datetime.timedelta(days=float(value))).strftime('%Y-%m-%dT%H:%M:%S')
                    except (ValueError, OverflowError):
                        warnings.append('Unrecognized date in ' + HEADERS[ord(col)-65])
                        return None
                run = dict(id=identifier, game=game, sourceSheet=sheet, runner=row.get('F', ''), status=row.get('A', ''), checker=row.get('B', ''), tier=row.get('H', ''), restrictions=row.get('I', ''), extraRestrictions=row.get('J', ''), platform=row.get('N', ''), evidence=row.get('G', ''), notes=row.get('E', ''), teamHitlessVerified=row.get('L', ''), teamHitlessProfile=row.get('M', ''), submitted=date_value('O'), claimed=date_value('C'), checked=date_value('D'), rawDates={col: row.get(col, '') for col in ['O', 'C', 'D']}, warnings=warnings)
                completed = run['status'] in ['Accepted', 'Accepted (Not announced)', 'Rejected']
                if completed and not run['checked']:
                    warnings.append('Completed status without Checked Date')
                for a, b in [('claimed', 'submitted'), ('checked', 'claimed'), ('checked', 'submitted')]:
                    if run[a] and run[b] and run[a] < run[b]:
                        warnings.append(a.title() + ' date precedes ' + b + ' date')
                runs.append(run)
        payload = dict(source=dict(kind='excel-snapshot', filename=source.name, sha256=hashlib.sha256(source.read_bytes()).hexdigest(), importedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(), timezone=None, latestSubmission=max((r['submitted'] for r in runs if r['submitted']), default=None)), runs=runs)
        output.parent.mkdir(parents=True, exist_ok=True)
        temporary = output.with_suffix('.tmp')
        temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
        temporary.replace(output)
        print('Imported', len(runs), 'runs from seven game worksheets.')
        print('Statuses:', dict(collections.Counter(r['status'] for r in runs)))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Read-only Excel snapshot import into private local storage.')
    parser.add_argument('source', type=Path)
    args = parser.parse_args()
    import_snapshot(args.source, Path(__file__).resolve().parent.parent / '.local' / 'snapshot.json')
