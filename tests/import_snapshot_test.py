import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import xml.etree.ElementTree as ET
import zipfile

spec = importlib.util.spec_from_file_location('snapshot_importer', str(Path(__file__).resolve().parent.parent / 'scripts' / 'import-snapshot.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
N = module.NS['m']
R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'


def workbook(path, reverse=False, duplicate=False):
    root = ET.Element('{%s}workbook' % N)
    sheets = ET.SubElement(root, '{%s}sheets' % N)
    relationships = ET.Element('Relationships')
    with zipfile.ZipFile(str(path), 'w') as archive:
        for i, (name, _) in enumerate(module.GAMES):
            identifier = 'r' + str(i)
            ET.SubElement(sheets, '{%s}sheet' % N, {'name': name, '{%s}id' % R: identifier})
            ET.SubElement(relationships, 'Relationship', {'Id': identifier, 'Target': 'worksheets/sheet%d.xml' % i})
            sheet = ET.Element('{%s}worksheet' % N)
            data = ET.SubElement(sheet, '{%s}sheetData' % N)
            values = [dict((chr(65+j), header) for j, header in enumerate(module.HEADERS))]
            if i == 0:
                a = {'A':'Accepted','B':'Example Reviewer','F':'Example One','G':'https://example.test/one','H':'Master','O':'46000.5','E':'Keep original note'}
                b = {'A':'New','F':'Example Two','G':'https://example.test/two','H':'Champion','O':'46001.5'}
                values += [b,a] if reverse else [a,b]
                if duplicate:
                    values.append(a)
            for index, entries in enumerate(values,1):
                row = ET.SubElement(data,'{%s}row' % N,{'r':str(index)})
                for col, value in entries.items():
                    cell = ET.SubElement(row,'{%s}c' % N,{'r':col+str(index),'t':'inlineStr'})
                    ET.SubElement(ET.SubElement(cell,'{%s}is' % N),'{%s}t' % N).text=value
            row=ET.SubElement(data,'{%s}row' % N,{'r':'350'})
            cell=ET.SubElement(row,'{%s}c' % N,{'r':'K350'})
            ET.SubElement(cell,'{%s}f' % N).text='TODAY()'
            ET.SubElement(cell,'{%s}v' % N).text='123'
            archive.writestr('xl/worksheets/sheet%d.xml' % i,ET.tostring(sheet))
        archive.writestr('xl/workbook.xml',ET.tostring(root))
        archive.writestr('xl/_rels/workbook.xml.rels',ET.tostring(relationships))


class ImportTests(unittest.TestCase):
    def test_identity_missing_dates_and_formula_only_rows(self):
        with tempfile.TemporaryDirectory() as temporary:
            source=Path(temporary)/'example.xlsx'
            output=Path(temporary)/'snapshot.json'
            workbook(source)
            module.import_snapshot(source,output)
            first=json.loads(output.read_text(encoding='utf-8'))['runs']
            self.assertEqual(len(first),2)
            self.assertIsNone(first[0]['claimed'])
            self.assertIsNone(first[0]['checked'])
            self.assertEqual(first[0]['notes'],'Keep original note')
            self.assertEqual(first[0]['game'],"Demon's Souls")
            workbook(source,reverse=True)
            module.import_snapshot(source,output)
            second=json.loads(output.read_text(encoding='utf-8'))['runs']
            self.assertEqual({r['runner']:r['id'] for r in first},{r['runner']:r['id'] for r in second})
            previous=output.read_bytes()
            workbook(source,duplicate=True)
            with self.assertRaises(ValueError):
                module.import_snapshot(source,output)
            self.assertEqual(previous,output.read_bytes())

if __name__ == '__main__':
    unittest.main()
