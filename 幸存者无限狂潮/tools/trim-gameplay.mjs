import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';

// Keep the opening, middle and ending at their original speed and with game audio.
const root=path.resolve(import.meta.dirname,'..');
const captureRoot=path.join(root,'output/gameplay-recording');
const take=process.argv[2]||'';
if(take&&!/^[a-z0-9-]+$/.test(take))throw Error('Take must be a lowercase filename slug');
const out=take?path.join(captureRoot,take):captureRoot;
const recording=JSON.parse(await readFile(path.join(out,'report.json'),'utf8'));
if(recording.errors?.length||!recording.output)throw Error('Recording has not completed successfully');
const source=path.resolve(recording.output),media=path.join(root,'media')+path.sep;
if(!source.startsWith(media))throw Error('Source must be a recording in the game media directory');
const fps=30,frames=Math.ceil(recording.capture.durationSeconds*fps);
if(frames<40*fps)throw Error('At least 40 seconds of source footage is needed for three distinct excerpts');
const middle=Math.floor((frames-9*fps)/2);
const segments=[[0,8*fps],[middle,middle+9*fps],[frames-8*fps,frames]];
const graph=['[0:v]split=3[v0][v1][v2]','[0:a]asplit=3[a0][a1][a2]'];
segments.forEach(([start,end],i)=>{
  graph.push(`[v${i}]trim=start_frame=${start}:end_frame=${end},setpts=PTS-STARTPTS[p${i}]`);
  graph.push(`[a${i}]atrim=start=${start/fps}:end=${end/fps},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.02,afade=t=out:st=${(end-start)/fps-.02}:d=0.02[s${i}]`);
});
graph.push('[p0][s0][p1][s1][p2][s2]concat=n=3:v=1:a=1[v][a]');
const output=source.replace(/\.mp4$/,'-25s.mp4');
if(output===source)throw Error('Expected an MP4 recording');
const ffmpeg=path.join(captureRoot,'tooling/node_modules/ffmpeg-static/ffmpeg.exe');
const run=spawnSync(ffmpeg,['-hide_banner','-y','-i',source,'-filter_complex',graph.join(';'),'-map','[v]','-map','[a]','-t','25','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-r','30','-threads','2','-c:a','aac','-b:a','128k','-movflags','+faststart',output],{encoding:'utf8',windowsHide:true});
await writeFile(path.join(out,'edit-25s-encode.log'),run.stderr||'');
if(run.status!==0)throw Error(`Clip encode failed: ${run.error?.message||run.stderr?.slice(-1000)}`);
const report={source:path.relative(root,source),output:path.relative(root,output),source_segments_seconds:segments.map(s=>s.map(f=>f/fps)),target_duration_seconds:25,target_frames:750,dimensions:recording.viewport,fps,audio:'Original game audio, with 20ms fades at edit points',validation:'Pending decode and visual review'};
await writeFile(path.join(out,'edit-25s.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
