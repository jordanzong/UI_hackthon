#!/usr/bin/env python3
"""Import only nine revised R Draconis runs from the team's real ZIP.

Keeps the other 36 science runs and all HYG/Gaia science assets unchanged.
"""
import argparse
import json
import shutil
import tempfile
import zipfile
from pathlib import Path

from build_science_run_manifests import build
from publish_science_visuals import publish

TARGET="R_Draconis"

def import_r(archive,output):
    output=Path(output).resolve()
    index_path=output/"index.json"
    original=json.loads(index_path.read_text(encoding="utf-8"))
    r=next(x for x in original["targets"] if x["target_id"]==TARGET)
    if r["runs"]:
        raise ValueError("R Draconis already published: use explicit update workflow")
    with tempfile.TemporaryDirectory(prefix="rdraconis-") as td:
        scratch=Path(td)
        input_root=scratch/"input"
        count=0
        with zipfile.ZipFile(archive) as z:
            for member in z.infolist():
                parts=member.filename.replace("\\","/").split("/")
                if "analysis_runs" not in parts:
                    continue
                at=parts.index("analysis_runs")
                if at<1 or parts[at-1]!=TARGET or at+1>=len(parts):
                    continue
                rest=parts[at:]
                dest=input_root/TARGET/Path(*rest)
                dest=dest.resolve()
                if not dest.is_relative_to(input_root.resolve()):
                    raise ValueError("Unsafe ZIP path: "+member.filename)
                if member.is_dir():
                    dest.mkdir(parents=True,exist_ok=True)
                    continue
                if member.file_size > 180*1024*1024:
                    raise ValueError("Oversized science file: "+member.filename)
                dest.parent.mkdir(parents=True,exist_ok=True)
                with z.open(member) as source,dest.open("wb") as sink:
                    shutil.copyfileobj(source,sink)
                count+=1
        print("R Draconis extracted source files:",count)
        staged=scratch/"export"
        produced=build(input_root,staged,False)
        rnew=next(t for t in produced["targets"] if t["target_id"]==TARGET)
        if len(rnew["runs"])!=9:
            raise ValueError(f"Expected nine corrected R Draconis runs, found {len(rnew['runs'])}")
        for run in rnew["runs"]:
            mp=staged/run["manifest_url"]
            m=json.loads(mp.read_text())
            p=m["bands"][run["band_id"]]
            if not p["seds"] or not p["frames"] or p["blink_url"]!="media/group_stacks_marked.gif":
                raise ValueError("Run incomplete (SED, Group or marked GIF): "+run["run_id"])
        # Copy the new target only, preserving all four existing targets verbatim.
        target_dir=staged/rnew["slug"]
        shutil.copytree(target_dir,output/rnew["slug"],dirs_exist_ok=False)
        r["runs"]=rnew["runs"]
        r["publication_status"]="ready"
        index_path.write_text(json.dumps(original,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    # Add real stack/diagnostic PNGs and synchronized marked GIF frames.
    publish(output,archive,targets=(TARGET,))
    print("PASS: nine R Draconis runs published. Total 45 runs; other targets unchanged.")

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--archive",required=True,type=Path)
    p.add_argument("--science-dir",default="science-runs",type=Path)
    a=p.parse_args()
    import_r(a.archive,a.science_dir)
