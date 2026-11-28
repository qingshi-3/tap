(() => {
  const rows=globalThis.DuelystLibrary.list('unit');
  const known=new Map(rows.map(row=>[row.id+'.png',row]));
  const store='duelyst-unit-grades-by-id-v1';
  const overrides=new Map();
  const isGrade=value=>value===null||Number.isInteger(value)&&value>=1&&value<=5;
  let storageMessage='';
  try{for(const [id,grade] of JSON.parse(localStorage.getItem(store)||'[]'))if(known.has(id+'.png')&&isGrade(grade))overrides.set(id,grade)}catch{storageMessage='浏览器分档记录未读取，请用已导出的清单恢复。'}
  const gradeOf=row=>overrides.has(row.id)?overrides.get(row.id):row.grade;
  function backup(){try{localStorage.setItem(store,JSON.stringify([...overrides]));storageMessage='已保存到此浏览器。'}catch{storageMessage='本次修改已保留，请导出清单保存。'}}
  function change(row,value){if(!isGrade(value))throw Error('档位无效');if(row.grade===value)overrides.delete(row.id);else overrides.set(row.id,value)}
  function load(entries){if(!Array.isArray(entries)||!entries.length)throw Error('需要分档清单数组');const updated=new Map();for(const entry of entries){const name=entry['文件名'],value=entry['分档']==='待设置'?null:entry['分档'];if(!known.has(name)||!isGrade(value)||updated.has(name))throw Error('文件名、档位或重复条目有误');updated.set(name,value)}for(const [name,value] of updated)change(known.get(name),value);backup();return updated.size}
  const exportRows=()=>rows.map(row=>({'编号':row.number,'文件名':row.id+'.png','分档':gradeOf(row)??'待设置','造型理由':row.reason}));
  globalThis.DuelystGrades={gradeOf,set(row,value){change(row,value);backup()},load,exportRows,status:()=>storageMessage};
})();
