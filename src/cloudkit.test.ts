import {it,expect,vi} from 'vitest';
import {fetchCloudRecord,saveCloudLibrary,type CloudDatabase,type CloudRecord} from './cloudkit';
import {initial,importLibrary} from './core';
it('recognizes an empty private database without hiding authentication failures',async()=>{
  const db:CloudDatabase={fetchRecords:vi.fn().mockResolvedValue({hasErrors:true,errors:[{ckErrorCode:'UNKNOWN_ITEM'}],records:[]}),saveRecords:vi.fn()};
  expect(await fetchCloudRecord(db)).toBeNull();
  vi.mocked(db.fetchRecords).mockResolvedValue({hasErrors:true,errors:[{ckErrorCode:'AUTHENTICATION_REQUIRED'}],records:[]});
  await expect(fetchCloudRecord(db)).rejects.toThrow('AUTHENTICATION_REQUIRED');
});
it('uploads a private backup asset with the fetched change tag and no API credentials',async()=>{
  const record:CloudRecord={recordName:'margin-library-v1',recordChangeTag:'old',fields:{}};
  const db:CloudDatabase={fetchRecords:vi.fn(),saveRecords:vi.fn().mockResolvedValue({records:[{...record,recordChangeTag:'new'}]})};
  const lib={...initial,prefs:{...initial.prefs,apiKey:'secret-not-for-cloud'}};
  expect((await saveCloudLibrary(db,lib,record)).recordChangeTag).toBe('new');
  const payload=vi.mocked(db.saveRecords).mock.calls[0][0];
  expect(payload.recordChangeTag).toBe('old');
  const raw=await (payload.fields.backup.value as Blob).text();
  expect(raw).not.toContain('secret-not-for-cloud');
  expect(importLibrary(raw).subjects).toEqual(initial.subjects);
});
it('reports write conflicts without retrying a force overwrite',async()=>{
  const db:CloudDatabase={fetchRecords:vi.fn(),saveRecords:vi.fn().mockResolvedValue({hasErrors:true,errors:[{ckErrorCode:'CONFLICT'}],records:[]})};
  await expect(saveCloudLibrary(db,initial,null)).rejects.toThrow('CONFLICT');
  expect(db.saveRecords).toHaveBeenCalledTimes(1);
});
