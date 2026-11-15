#!/usr/bin/env python3
"""Print actual visualization filenames from a SPHEREx analysis archive; no modification."""
from collections import Counter, defaultdict
from pathlib import PurePosixPath
import sys,zipfile
archive=sys.argv[1]
count=Counter();examples=defaultdict(list);byrun=defaultdict(set)
with zipfile.ZipFile(archive) as z:
 for item in z.infolist():
  if item.is_dir():continue
  p=PurePosixPath(item.filename)
  parts=p.parts
  if '__MACOSX' in parts:continue
  if 'analysis_runs' not in parts:continue
  k=parts.index('analysis_runs')
  if k<1 or k+1>=len(parts):continue
  tid,run=parts[k-1],parts[k+1]
  if tid not in ('WISE_0855','Barnards_Star','Epsilon_Indi_B','RW_Aurigae'):continue
  relative=parts[k+2:]
  if len(relative)==1 and relative[0].lower().endswith(('.png','.jpg','.jpeg','.gif','.webp','.pdf','.svg')):
   count[relative[0]]+=1;byrun[(tid,run)].add(relative[0])
   if len(examples[relative[0]])<2:examples[relative[0]].append(item.filename)
  if any(w in p.name.lower() for w in ('diagnos','overview','timeline','time_group','stack_summary','stack_mosaic','stack_plot','stack_preview')):
   if p.name not in count and not (p.name.endswith('.fits')) and 'group_stack_frames' not in parts:
    count[p.name]+=1
    if len(examples[p.name])<2:examples[p.name].append(item.filename)
print('VISUAL ASSET BASENAMES / count / paths:')
for name,num in sorted(count.items()):print(num,repr(name),examples[name])
print('RUN-LEVEL IMAGE INVENTORY:')
for (tid,run),names in sorted(byrun.items()):print(tid,run,','.join(sorted(names)))
print('Runs with root-level visuals:',len(byrun))
