#!/usr/bin/env python3
"""Publish exact source diagnostics, Stack PNGs and annotated GIF frames.

No original group frames, SED, source positions, measurements or R Draconis
are changed. Source files are matched by exact Target + Run ID.
"""
import argparse
import hashlib
import io
import json
import shutil
import tempfile
import zipfile
from pathlib import Path
from PIL import Image

TARGETS=("WISE_0855","Barnards_Star","Epsilon_Indi_B","RW_Aurigae","R_Draconis")
IMAGES=("time_grouping_diagnostic.png","group_stacks_sources_epsf.png")
GIFS=("group_stacks_movers_variables.gif","group_stacks_marked.gif")
MAX=45*1024*1024

def archive_members(z):
    result={}
    for info in z.infolist():
        if info.is_dir():continue
        parts=info.filename.replace("\\","/").split("/")
        if "__MACOSX" in parts or "analysis_runs" not in parts:continue
        pos=parts.index("analysis_runs")
        if pos<1 or pos+3!=len(parts):continue
        key=(parts[pos-1],parts[pos+1],parts[pos+2])
        if key[0] not in TARGETS or key[2] not in IMAGES+GIFS:continue
        if key in result:raise ValueError("Duplicate ZIP asset "+repr(key))
        result[key]=info
    return result

def read_image(z,member,label):
    if member is None or not 64<=member.file_size<=MAX:
        raise ValueError("Missing or oversized ZIP asset "+label)
    data=z.read(member)
    with Image.open(io.BytesIO(data)) as image:
        if image.format!="PNG" or image.width<10 or image.height<10:
            raise ValueError("Invalid PNG "+label)
        image.verify()
    return data

def publish(root,archive,targets=TARGETS[:4]):
    root=Path(root).resolve()
    idx=json.loads((root/"index.json").read_text(encoding="utf-8"))
    prepared=[]
    with tempfile.TemporaryDirectory() as temp, zipfile.ZipFile(archive) as z:
        scratch=Path(temp)
        zipindex=archive_members(z)
        for target in idx["targets"]:
            tid=target["target_id"]
            if tid not in targets:continue
            if len(target["runs"])!=9:raise ValueError("Expected nine runs for "+tid)
            for run in target["runs"]:
                rid=run["run_id"]
                manifest_path=(root/run["manifest_url"]).resolve()
                if not manifest_path.is_relative_to(root) or not manifest_path.is_file():
                    raise ValueError("Invalid or missing manifest "+repr(run))
                m=json.loads(manifest_path.read_text(encoding="utf-8"))
                band=run["band_id"]
                if (m["target_id"],m["run_id"],m["band_id"])!=(tid,rid,band):
                    raise ValueError("Manifest identity mismatch")
                p=m["bands"][band]
                if p.get("blink_url")!="media/group_stacks_marked.gif":
                    raise ValueError("No marked GIF referenced for "+rid)
                published_gif=manifest_path.parent/"media/group_stacks_marked.gif"
                if not published_gif.is_file():raise ValueError("Missing marked GIF")
                zip_gif=next((zipindex.get((tid,rid,g)) for g in GIFS
                              if (tid,rid,g) in zipindex),None)
                if zip_gif is None:raise ValueError("No matching marked GIF in ZIP "+rid)
                raw=published_gif.read_bytes()
                if hashlib.sha256(raw).digest()!=hashlib.sha256(z.read(zip_gif)).digest():
                    raise ValueError("Published GIF differs from ZIP: "+tid+"/"+rid)
                dest=scratch/tid/rid
                dest.mkdir(parents=True,exist_ok=True)
                for name in IMAGES:
                    data=read_image(z,zipindex.get((tid,rid,name)),tid+"/"+rid+"/"+name)
                    (dest/name).write_bytes(data)
                group=p.get("frames",[])
                frames=[]
                with Image.open(io.BytesIO(raw)) as gif:
                    if gif.n_frames!=len(group):
                        raise ValueError(f"Group count {len(group)} != marked GIF "
                                         f"frames {gif.n_frames} for {tid}/{rid}")
                    for i,source in enumerate(group):
                        gif.seek(i)
                        duration=max(80,min(5000,int(gif.info.get("duration",800) or 800)))
                        name=f"group_{i+1:03d}.webp"
                        gif.convert("RGB").save(dest/name,"WEBP",lossless=True,method=4)
                        entry={
                            "frame_id":str(source.get("frame_id",f"group_{i+1}")),
                            "label":str(source.get("label",f"Group {i+1}")),
                            "image_url":"media/viewer_marked_frames/"+name,
                            "duration_ms":duration
                        }
                        for key in ("mjd","start_mjd","end_mjd","stack_inputs"):
                            if key in source:entry[key]=source[key]
                        frames.append(entry)
                p["viewer_frames"]=frames
                p["viewer_frame_source"]="group_stacks_marked.gif"
                p["diagnostic_url"]="media/time_grouping_diagnostic.png"
                p["stack_url"]="media/group_stacks_sources_epsf.png"
                prepared.append((manifest_path,m,dest))
        if len(prepared)!=9*len(targets):
            raise ValueError("Expected "+str(9*len(targets))+" validated run visuals")
        # No files modified until all 36 runs have passed.
        for path,m,staged in prepared:
            media=path.parent/"media"
            media.mkdir(parents=True,exist_ok=True)
            for name in IMAGES:shutil.copyfile(staged/name,media/name)
            out=media/"viewer_marked_frames"
            out.mkdir(parents=True,exist_ok=True)
            for frame in m["bands"][m["band_id"]]["viewer_frames"]:
                name=Path(frame["image_url"]).name
                shutil.copyfile(staged/name,out/name)
            path.write_text(json.dumps(m,ensure_ascii=False,indent=2,
                                       allow_nan=False)+"\n",encoding="utf-8")
    print("PASS published "+str(len(prepared))+" real STACK PNGs / Time Grouping diagnostics "
          "and all marked GIF viewer frames; originals not modified")

if __name__=="__main__":
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--archive",type=Path,required=True)
    ap.add_argument("--science-dir",type=Path,default=Path("science-runs"))
    ap.add_argument("--targets",nargs="+",default=list(TARGETS[:4]),choices=TARGETS)
    a=ap.parse_args()
    publish(a.science_dir,a.archive,targets=tuple(a.targets))
