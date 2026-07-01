import React, { useCallback, useEffect, useState } from "react";
import ReactDOM from "react-dom";

import {
  deleteTakeoffJob as deleteJob,
  loadAllTakeoffJobs as loadAllJobs,
  loadTakeoffAutosave as loadAutosave,
  saveTakeoffAutosave as saveAutosave,
  saveTakeoffJob as saveJob,
} from "./takeoffStorage.js";
import { buildQuoteSummary } from "./quoteSummary.js";
import { getCalculatedOptionTotal, getFinalOptionTotal, getOptionAdjustmentsTotal, getOptionLineItemsTotal, getPsoCredit } from "./quoteMath.js";
import { saveQuoteSummary } from "./quoteStorage.js";

// ════════════════════════════════════════════════════════
// ─── QUOTE / TAKEOFF MODULE ──────────────────────────
// ════════════════════════════════════════════════════════

const Q_COMPANY = { name: "Insulation Services of Tulsa", tagline: "Serving Northeastern Oklahoma", phone: "1 (918) 232-9055" };
const Q_SALESMAN_INFO = {
  "Johnny": { fullName: "Johnny Casper", phone: "918-550-2396", email: "Johnny@istulsa.com" },
  "Jordan": { fullName: "Jordan Beard", phone: "918-625-7820", email: "Jordan@istulsa.com" },
  "Skip":   { fullName: "Skip Owen",    phone: "918-219-7890", email: "Skip@istulsa.com" },
};
const Q_LOCATIONS = [
  { id: "band_joist",       label: "Band Joist Blocking",            short: "Band Joist",       type: "area",    group: "Porch / Blocking" },
  { id: "ext_walls_house",  label: "Boxed Exterior Walls of House",  short: "Ext Walls House",  type: "wall",    group: "Walls" },
  { id: "ext_walls_garage", label: "Boxed Exterior Walls of Garage", short: "Ext Walls Garage", type: "wall",    group: "Walls" },
  { id: "garage_common",    label: "Garage Common Wall",             short: "Garage Common",    type: "wall",    group: "Walls" },
  { id: "open_attic_walls", label: "Open Attic Walls",               short: "Attic Walls",      type: "wall",    group: "Walls" },
  { id: "ext_slopes",       label: "Boxed Exterior Slopes",          short: "Ext Slopes",       type: "slope",   group: "Attic" },
  { id: "ext_kneewall",     label: "Boxed Exterior Kneewall",        short: "Ext Kneewall",     type: "wall",    group: "Attic" },
  { id: "attic_slopes",     label: "Open Attic Slopes",              short: "Attic Slopes",     type: "area",    group: "Attic" },
  { id: "attic_kneewall",   label: "Open Attic Kneewall",            short: "Attic Kneewall",   type: "wall",    group: "Attic" },
  { id: "flat_ceiling",     label: "Flat Ceiling",                   short: "Flat Ceiling",     type: "area",    group: "Attic" },
  { id: "attic_area_house", label: "Open Attic Area of House",       short: "Attic House",      type: "area",    group: "Attic" },
  { id: "attic_area_garage",label: "Open Attic Area of Garage",      short: "Attic Garage",     type: "area",    group: "Attic" },
  { id: "gable_end",        label: "Gable End",                      short: "Gable End",        type: "area",    group: "Roofline" },
  { id: "porch",            label: "Porch",                          short: "Porch",            type: "area",    group: "Porch / Blocking" },
  { id: "porch_blocking",   label: "Porch Blocking",                 short: "Porch Blocking",   type: "area",    group: "Porch / Blocking" },
  { id: "roofline",         label: "Roofline",                       short: "Roofline",         type: "roofline",group: "Roofline" },
  { id: "roofline_garage",  label: "Roofline of Garage",             short: "Roofline Garage",  type: "roofline",group: "Roofline" },
  { id: "roofline_house",   label: "Roofline of House",              short: "Roofline House",   type: "roofline",group: "Roofline" },
  { id: "custom",           label: "Custom",                         short: "Custom",           type: "area",    group: "Other" },
];
const Q_PITCH_FACTORS = { "Flat (0/12)":1.0,"1/12":1.003,"2/12":1.014,"3/12":1.031,"4/12":1.054,"5/12":1.083,"6/12":1.118,"7/12":1.158,"8/12":1.202,"9/12":1.25,"10/12":1.302,"11/12":1.357,"12/12":1.414 };
const Q_WALL_HEIGHTS = [
  { label: "8' walls (10.00 sq ft each)",  sqftPer: 10    },
  { label: "9' walls (11.25 sq ft each)",  sqftPer: 11.25 },
  { label: "10' walls (12.50 sq ft each)", sqftPer: 12.5  },
  { label: "11' walls (13.75 sq ft each)", sqftPer: 13.75 },
  { label: "12' walls (15.00 sq ft each)", sqftPer: 15    },
];
const Q_GROUP_ORDER = ["Walls","Attic","Porch / Blocking","Roofline","Other"];
const Q_STATUS_CONFIG = {
  draft:   { label: "Draft",   color: "#6b7280", bg: "#f3f4f6" },
  quoted:  { label: "Quoted",  color: "#1a56db", bg: "#eef2ff" },
  pending: { label: "Pending", color: "#b45309", bg: "#fef3c7" },
  sold:    { label: "Sold",    color: "#15803d", bg: "#dcfce7" },
  lost:    { label: "Lost",    color: "#b91c1c", bg: "#fee2e2" },
};

// ── Quote PDF helpers ──────────────────────────────────
function qSharePdfBlob(blob, filename) {
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: "application/pdf" })] })) {
    navigator.share({ files: [new File([blob], filename, { type: "application/pdf" })], title: filename }).catch(err => { if (err.name !== "AbortError") alert("Share failed: " + err.message); });
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}


// ── Real QuoteView from ist-quote-builder (verbatim port) ──────────


var COMPANY = {
  name: "Insulation Services of Tulsa",
  tagline: "Serving Northeastern Oklahoma",
  phone: "1 (918) 232-9055",
};

var SALESMAN_INFO = {
  "Johnny": { fullName: "Johnny Casper", phone: "918-550-2396", email: "Johnny@istulsa.com" },
  "Jordan": { fullName: "Jordan Beard", phone: "918-625-7820", email: "Jordan@istulsa.com" },
  "Skip": { fullName: "Skip Owen", phone: "918-219-7890", email: "Skip@istulsa.com" },
};

var LOCATIONS = [
  { id: "band_joist",       label: "Band Joist Blocking",           short: "Band Joist",        type: "area",    group: "Porch / Blocking" },
  { id: "ext_walls_house",  label: "Boxed Exterior Walls of House", short: "Ext Walls House",   type: "wall",    group: "Walls" },
  { id: "ext_walls_garage", label: "Boxed Exterior Walls of Garage",short: "Ext Walls Garage",  type: "wall",    group: "Walls" },
  { id: "garage_common",    label: "Garage Common Wall",            short: "Garage Common",     type: "wall",    group: "Walls" },
  { id: "open_attic_walls", label: "Open Attic Walls",              short: "Attic Walls",       type: "wall",    group: "Walls" },
  { id: "ext_slopes",       label: "Boxed Exterior Slopes",         short: "Ext Slopes",        type: "slope",   group: "Attic" },
  { id: "ext_kneewall",     label: "Boxed Exterior Kneewall",       short: "Ext Kneewall",      type: "wall",    group: "Attic" },
  { id: "attic_slopes",     label: "Open Attic Slopes",             short: "Attic Slopes",      type: "area",    group: "Attic" },
  { id: "attic_kneewall",   label: "Open Attic Kneewall",           short: "Attic Kneewall",    type: "wall",    group: "Attic" },
  { id: "flat_ceiling",     label: "Flat Ceiling",                  short: "Flat Ceiling",      type: "area",    group: "Attic" },
  { id: "attic_area_house", label: "Open Attic Area of House",      short: "Attic House",       type: "area",    group: "Attic" },
  { id: "attic_area_garage",label: "Open Attic Area of Garage",     short: "Attic Garage",      type: "area",    group: "Attic" },
  { id: "gable_end",        label: "Gable End",                     short: "Gable End",         type: "area",    group: "Roofline" },
  { id: "porch",            label: "Porch",                         short: "Porch",             type: "area",    group: "Porch / Blocking" },
  { id: "porch_blocking",   label: "Porch Blocking",                short: "Porch Blocking",    type: "area",    group: "Porch / Blocking" },
  { id: "roofline",         label: "Roofline",                      short: "Roofline",          type: "roofline",group: "Roofline" },
  { id: "roofline_garage",  label: "Roofline of Garage",            short: "Roofline Garage",   type: "roofline",group: "Roofline" },
  { id: "roofline_house",   label: "Roofline of House",             short: "Roofline House",    type: "roofline",group: "Roofline" },
  { id: "custom",           label: "Custom",                        short: "Custom",            type: "area",    group: "Other" },
];

var FIBERGLASS_MATERIALS = [
  "Blown Fiberglass", "R11 Fiberglass Batts", "R13 Fiberglass Batts", "R15 Fiberglass Batts",
  "R19 Fiberglass Batts", "R22 Blown Fiberglass", "R26 Blown Fiberglass", "R30 Fiberglass Batts", "R38 Fiberglass Batts",
  "Blown Cellulose", "Blown Rockwool", "Rockwool", '6" Rockwool', "Lambswool",
];

var OPEN_CELL_MATERIALS = [];
[0.5,1,1.5,2,2.5,3,3.5,4,4.5,5,5.5,6].forEach(function(n){ OPEN_CELL_MATERIALS.push(n+'" Open Cell Foam'); });

var CLOSED_CELL_MATERIALS = [];
[0.5,1,1.5,2,2.5,3,3.5,4,4.5,5,5.5,6].forEach(function(n){ CLOSED_CELL_MATERIALS.push(n+'" Closed Cell Foam'); });

var ALL_MATERIALS = FIBERGLASS_MATERIALS.concat(OPEN_CELL_MATERIALS).concat(CLOSED_CELL_MATERIALS);

var PITCH_FACTORS = {"Flat (0/12)":1.0,"1/12":1.003,"2/12":1.014,"3/12":1.031,"4/12":1.054,"5/12":1.083,"6/12":1.118,"7/12":1.158,"8/12":1.202,"9/12":1.25,"10/12":1.302,"11/12":1.357,"12/12":1.414};

var WALL_HEIGHTS = [
  {label:"8' walls (10.00 sq ft each)",sqftPer:10},{label:"9' walls (11.25 sq ft each)",sqftPer:11.25},
  {label:"10' walls (12.50 sq ft each)",sqftPer:12.5},{label:"11' walls (13.75 sq ft each)",sqftPer:13.75},
  {label:"12' walls (15.00 sq ft each)",sqftPer:15},
];

var GROUP_ORDER = ["Walls","Attic","Porch / Blocking","Roofline","Other"];

var C = {
  bg:"linear-gradient(135deg, #e8eef8 0%, #dde6f5 40%, #cdd9f0 100%)",
  bgSolid:"#e8eef8",
  card:"rgba(255,255,255,0.65)",
  cardHover:"rgba(255,255,255,0.8)",
  glass:"rgba(255,255,255,0.6)",
  glassBorder:"rgba(255,255,255,0.8)",
  glassStrong:"rgba(255,255,255,0.75)",
  accent:"#2563eb",
  accentHover:"#1d4ed8",
  accentBg:"rgba(37,99,235,0.08)",
  accentGlow:"0 0 20px rgba(37,99,235,0.2)",
  text:"#0f172a",
  textSec:"#475569",
  dim:"#94a3b8",
  border:"rgba(0,0,0,0.08)",
  borderLight:"rgba(0,0,0,0.04)",
  input:"rgba(255,255,255,0.7)",
  inputBorder:"rgba(0,0,0,0.12)",
  danger:"#dc2626",
  dangerBg:"rgba(220,38,38,0.06)",
  green:"#16a34a",
  blue:"#2563eb",
  shadow:"0 4px 24px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)",
  shadowMd:"0 8px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.9)",
};

/* ──────── STORAGE HELPERS (Firebase) ──────── */

/* ──────── UI COMPONENTS ──────── */

var glassInput={width:"100%",padding:"10px 12px",background:"rgba(255,255,255,0.7)",border:"1px solid rgba(0,0,0,0.1)",borderRadius:8,color:"#0f172a",fontSize:15,fontFamily:"'Inter',sans-serif",outline:"none",boxSizing:"border-box",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",transition:"border-color 0.15s, box-shadow 0.15s"};
var _numpadBlurTimer=null;
var _numpadActiveSet=null;
function _numpadOpen(setShow){
  clearTimeout(_numpadBlurTimer);
  if(_numpadActiveSet&&_numpadActiveSet!==setShow){_numpadActiveSet(false);}
  _numpadActiveSet=setShow;
  setShow(true);
}
function _numpadClose(setShow){
  _numpadBlurTimer=setTimeout(function(){
    if(_numpadActiveSet===setShow){_numpadActiveSet=null;}
    setShow(false);
  },120);
}
function QV_Input(p){
  var isNum=!p.type||p.type==="number";
  var sp=React.useState(false),showPad=sp[0],setShowPad=sp[1];
  function padPress(v){
    var cur=String(p.value||"");
    if(v==="⌫"){p.onChange(cur.slice(0,-1));}
    else if(v==="."&&cur.includes(".")){return;}
    else{p.onChange(cur+v);}
  }
  var padNums=["7","8","9","4","5","6","1","2","3",".","0","⌫"];
  return(<div style={{position:"relative"}}>
    <label style={{fontSize:11,fontWeight:600,color:C.textSec,marginBottom:5,display:"block",textTransform:"uppercase",letterSpacing:"0.08em"}}>{p.label}</label>
    <input className={p.pulse?"ist-pulse":""} style={Object.assign({},glassInput,{caretColor:isNum?"transparent":"auto"})}
      onFocus={function(e){e.target.style.borderColor=C.accent;e.target.style.boxShadow="0 0 0 3px rgba(37,99,235,0.15)";if(isNum)_numpadOpen(setShowPad);}}
      onBlur={function(e){e.target.style.borderColor="rgba(0,0,0,0.1)";e.target.style.boxShadow="none";if(isNum)_numpadClose(setShowPad);}}
      readOnly={isNum} inputMode={isNum?"none":undefined}
      type={isNum?"text":p.type} value={p.value}
      onChange={isNum?function(){}:function(e){p.onChange(e.target.value);}}
      placeholder={p.placeholder} step={p.step}/>
    {isNum&&showPad&&ReactDOM.createPortal(
      (<div onMouseDown={function(e){e.preventDefault();}} style={{position:"fixed",zIndex:9999,bottom:0,left:0,right:0,background:"#f1f5f9",boxShadow:"0 -2px 16px rgba(0,0,0,0.18)",borderTop:"2px solid #2563eb",padding:"10px 16px 24px"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:8,maxWidth:400,margin:"0 auto 8px"}}>
          {padNums.map(function(v){return(<button key={v} onMouseDown={function(e){e.preventDefault();padPress(v);}} style={{padding:"14px 0",borderRadius:10,border:"1px solid #cbd5e1",background:v==="⌫"?"#fee2e2":"#fff",color:v==="⌫"?"#dc2626":"#0f172a",fontSize:18,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",boxShadow:"0 1px 3px rgba(0,0,0,0.1)"}}>{v}</button>);})}
        </div>
        <button onMouseDown={function(e){e.preventDefault();clearTimeout(_numpadBlurTimer);_numpadActiveSet=null;setShowPad(false);}} style={{display:"block",maxWidth:400,width:"100%",margin:"0 auto",padding:"13px",borderRadius:10,border:"none",background:"#2563eb",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",letterSpacing:"0.06em",textTransform:"uppercase"}}>Done</button>
      </div>),
      document.body
    )}
  </div>);}


function AppSelect(p){return(<div><label style={{fontSize:11,fontWeight:600,color:C.textSec,marginBottom:5,display:"block",textTransform:"uppercase",letterSpacing:"0.08em"}}>{p.label}</label><select className={p.pulse?"ist-pulse":""} style={Object.assign({},glassInput,{WebkitAppearance:"none"})} onFocus={function(e){e.target.style.borderColor=C.accent;e.target.style.boxShadow="0 0 0 3px rgba(37,99,235,0.15)";}} onBlur={function(e){e.target.style.borderColor="rgba(0,0,0,0.1)";e.target.style.boxShadow="none";}} value={p.value} onChange={function(e){p.onChange(e.target.value);}}>{p.options.map(function(o){var v=typeof o==="string"?o:o.value;var l=typeof o==="string"?o:o.label;return(<option key={v} value={v} style={{background:"#fff",color:"#0f172a"}}>{l}</option>);})}</select></div>);}

function Row(p){return <div style={{display:"flex",gap:10,marginBottom:10}}>{p.children}</div>;}
function Col(p){return <div style={{flex:1}}>{p.children}</div>;}
function StepLabel(p){return(<label style={{fontSize:11,fontWeight:700,color:C.accent,marginBottom:5,display:"block",textTransform:"uppercase",letterSpacing:"0.08em"}}>{p.children}</label>);}

function ToggleButtons(p){return(<div style={{display:"flex",gap:2,background:"rgba(0,0,0,0.05)",padding:3,borderRadius:8,marginBottom:12,border:"1px solid rgba(0,0,0,0.07)"}}>{p.options.map(function(o){return(<button key={o.id} onClick={function(){p.setMode(o.id);}} style={{flex:1,padding:"8px 6px",borderRadius:6,fontSize:12,fontWeight:600,cursor:"pointer",border:p.mode===o.id?"1px solid rgba(37,99,235,0.3)":"1px solid transparent",fontFamily:"'Inter',sans-serif",textTransform:"uppercase",letterSpacing:"0.04em",background:p.mode===o.id?"rgba(255,255,255,0.9)":"transparent",color:p.mode===o.id?C.accent:C.textSec,boxShadow:p.mode===o.id?"0 1px 4px rgba(0,0,0,0.1)":"none",transition:"all 0.15s"}}>{o.label}</button>);})}</div>);}

function GreenBtn(p){return(<button onClick={p.onClick} className={p.pulse?"ist-pulse":""} style={{width:"100%",padding:"13px 20px",borderRadius:8,border:"1px solid rgba(37,99,235,0.3)",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"'Inter',sans-serif",textTransform:"uppercase",letterSpacing:"0.06em",background:"rgba(37,99,235,0.12)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",color:"#1d4ed8",marginTop:p.mt||0,boxShadow:"0 2px 12px rgba(37,99,235,0.15), inset 0 1px 0 rgba(255,255,255,0.8)",transition:"all 0.15s"}} onMouseOver={function(e){e.currentTarget.style.background="rgba(37,99,235,0.2)";e.currentTarget.style.boxShadow="0 4px 20px rgba(37,99,235,0.25), inset 0 1px 0 rgba(255,255,255,0.9)";}} onMouseOut={function(e){e.currentTarget.style.background="rgba(37,99,235,0.12)";e.currentTarget.style.boxShadow="0 2px 12px rgba(37,99,235,0.15), inset 0 1px 0 rgba(255,255,255,0.8)";}}>{p.children}</button>);}

/* ──────── MEASUREMENTS ──────── */

var CAVITY_WIDTHS=[{value:"",label:"— Cavity Width —"},{value:"2x4",label:"2x4"},{value:"2x6",label:"2x6"},{value:"2x8",label:"2x8"}];

function WallMeasurement(p){
  var s1=useState(p.lhOnly?"lh":"count"),mode=s1[0],setMode=s1[1];
  // sqft direct mode
  var sd=useState(""),ds=sd[0],setDs=sd[1];
  var s2=useState(""),wc=s2[0],setWc=s2[1];
  var s3=useState("0"),wi=s3[0],setWi=s3[1];
  var s4=useState(""),ln=s4[0],setLn=s4[1];
  var s5=useState(""),ht=s5[0],setHt=s5[1];
  var s6=useState(""),cw=s6[0],setCw=s6[1];
  var sq=mode==="count"?(parseInt(wc)||0)*(WALL_HEIGHTS[parseInt(wi)]?WALL_HEIGHTS[parseInt(wi)].sqftPer:0):(parseFloat(ln)||0)*(parseFloat(ht)||0);
  function notify(sqftVal,wiVal,wcVal,lnVal,htVal,modeVal,cwVal){
    var heightLabel=null;var dimStr="";
    var m=modeVal||mode;
    if(m==="count"){var h=WALL_HEIGHTS[parseInt(wiVal!==undefined?wiVal:wi)];if(h)heightLabel=h.label;var cavities=parseInt(wcVal!==undefined?wcVal:wc)||0;if(cavities>0&&heightLabel){heightLabel=cavities+" cavities @ "+heightLabel;dimStr=heightLabel;}}
    else{var l=lnVal!==undefined?lnVal:ln;var ht2=htVal!==undefined?htVal:ht;if(l&&ht2)dimStr=l+"×"+ht2;}
    var cavity=cwVal!==undefined?cwVal:cw;
    p.onSqftChange(sqftVal,heightLabel,cavity||null,dimStr||null);
  }
  return(<div>
    <ToggleButtons mode={mode} setMode={function(v){setMode(v);}} options={p.lhOnly?[{id:"lh",label:"L × H"},{id:"sqft",label:"Sq Ft"}]:[{id:"count",label:"Wall Count"},{id:"lh",label:"L × H"},{id:"sqft",label:"Sq Ft"}]}/>
    {mode==="count"&&(<Row><Col><QV_Input pulse={p.pulse} label="# of Cavities" value={wc} placeholder="0" onChange={function(v){setWc(v);var s=(parseInt(v)||0)*(WALL_HEIGHTS[parseInt(wi)]?WALL_HEIGHTS[parseInt(wi)].sqftPer:0);notify(s,wi,v,ln,ht,"count",cw);}}/></Col><Col><AppSelect pulse={p.pulse} label="Wall Height" value={wi} onChange={function(v){setWi(v);var s=(parseInt(wc)||0)*(WALL_HEIGHTS[parseInt(v)]?WALL_HEIGHTS[parseInt(v)].sqftPer:0);notify(s,v,wc,ln,ht,"count",cw);}} options={WALL_HEIGHTS.map(function(w,i){return{value:String(i),label:w.label};})}/></Col></Row>)}
    {mode==="lh"&&(<Row><Col><QV_Input pulse={p.pulse} label="Length (ft)" value={ln} placeholder="0" onChange={function(v){setLn(v);notify((parseFloat(v)||0)*(parseFloat(ht)||0),wi,wc,v,ht,"lh",cw);}}/></Col><Col><QV_Input pulse={p.pulse} label="Height (ft)" value={ht} placeholder="0" onChange={function(v){setHt(v);notify((parseFloat(ln)||0)*(parseFloat(v)||0),wi,wc,ln,v,"lh",cw);}}/></Col></Row>)}
    {mode==="sqft"&&(<div style={{marginBottom:10}}><QV_Input pulse={p.pulse} label="Total Sq Ft" value={ds} placeholder="0" onChange={function(v){setDs(v);p.onSqftChange(parseFloat(v)||0,null,null,v?v+" sf":null);}}/></div>)}
    {mode!=="sqft"&&<div style={{marginBottom:8}}><AppSelect pulse={p.pulse} label="Cavity Width" value={cw} onChange={function(v){setCw(v);notify(sq,wi,wc,ln,ht,mode,v);}} options={CAVITY_WIDTHS}/></div>}
    {(sq>0||parseFloat(ds)>0)&&(<div style={{fontSize:13,color:C.accent,fontWeight:600,marginBottom:8}}>{Math.round(mode==="sqft"?parseFloat(ds)||0:sq)+" sq ft"+(cw&&mode!=="sqft"?" · "+cw:"")}</div>)}
  </div>);
}

function AreaMeasurement(p){
  var s1=useState("dims"),mode=s1[0],setMode=s1[1];
  var s2=useState(""),ln=s2[0],setLn=s2[1];
  var s3=useState(""),wd=s3[0],setWd=s3[1];
  var s4=useState(""),ds=s4[0],setDs=s4[1];
  var sq=mode==="dims"?(parseFloat(ln)||0)*(parseFloat(wd)||0):(parseFloat(ds)||0);
  return(<div>
    <ToggleButtons mode={mode} setMode={setMode} options={[{id:"dims",label:"L × W"},{id:"sqft",label:"Sq Ft"}]}/>
    {mode==="dims"?(<Row><Col><QV_Input pulse={p.pulse} label="Length (ft)" value={ln} placeholder="0" onChange={function(v){setLn(v);var sq2=(parseFloat(v)||0)*(parseFloat(wd)||0);p.onSqftChange(sq2,null,null,(v&&wd)?v+"×"+wd:null);}}/></Col><Col><QV_Input pulse={p.pulse} label="Width (ft)" value={wd} placeholder="0" onChange={function(v){setWd(v);var sq2=(parseFloat(ln)||0)*(parseFloat(v)||0);p.onSqftChange(sq2,null,null,(ln&&v)?ln+"×"+v:null);}}/></Col></Row>):(<div style={{marginBottom:10}}><QV_Input pulse={p.pulse} label="Total Sq Ft" value={ds} placeholder="0" onChange={function(v){setDs(v);p.onSqftChange(parseFloat(v)||0,null,null,v?v+" sf":null);}}/></div>)}
    {sq>0&&(<div style={{fontSize:13,color:C.accent,fontWeight:600,marginBottom:8}}>{Math.round(sq)+" sq ft"}</div>)}
  </div>);
}

function LocationGrid(p){
  var groups=GROUP_ORDER.filter(function(g){return LOCATIONS.some(function(l){return l.group===g&&l.id!=="custom";});});
  return(<div style={{marginBottom:4}}>
    {groups.map(function(g){
      var locs=LOCATIONS.filter(function(l){return l.group===g&&l.id!=="custom";});
      return(<div key={g} style={{marginBottom:10}}>
        <div style={{fontSize:10,fontWeight:700,color:C.dim,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:5}}>{g}</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {locs.map(function(loc){
            var active=p.value===loc.id;
            return(<button key={loc.id} onClick={function(){p.onChange(loc.id);}} className={(p.pulse&&!p.value)?"ist-pulse":active?"ist-pulse-selected":""}
              style={{padding:"8px 13px",borderRadius:8,border:active?"2px solid "+C.accent:"1px solid rgba(0,0,0,0.08)",background:active?"rgba(37,99,235,0.1)":"rgba(255,255,255,0.6)",color:active?C.accent:C.text,fontSize:13,fontWeight:active?700:500,cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.12s",lineHeight:1.2,backdropFilter:"blur(8px)",boxShadow:active?"0 0 0 3px rgba(37,99,235,0.1)":"0 1px 3px rgba(0,0,0,0.06)"}}>
              {loc.short}
            </button>);
          })}
        </div>
      </div>);
    })}
    <button onClick={function(){p.onChange("custom");}}
      style={{padding:"8px 13px",borderRadius:8,border:p.value==="custom"?"2px solid "+C.accent:"1px dashed rgba(0,0,0,0.2)",background:p.value==="custom"?"rgba(37,99,235,0.08)":"rgba(255,255,255,0.4)",color:p.value==="custom"?C.accent:C.dim,fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
      + Custom
    </button>
  </div>);
}

function StepBar(p){
  var steps=p.steps;
  return(<div style={{display:"flex",alignItems:"center",gap:0,marginBottom:18}}>
    {steps.map(function(s,i){
      var done=i<p.current;var active=i===p.current;
      var bg=done?C.accent:active?C.accent:"transparent";
      var col=done||active?"#fff":C.dim;
      var borderCol=done||active?C.accent:C.border;
      return(<div key={i} style={{display:"flex",alignItems:"center",flex:i<steps.length-1?1:"none"}}>
        <div style={{display:"flex",alignItems:"center",gap:7,padding:"7px 12px",borderRadius:20,background:bg,border:"1.5px solid "+borderCol,transition:"all 0.15s"}}>
          <span style={{fontSize:12,fontWeight:800,color:col}}>{done?"✓":(i+1)}</span>
          <span style={{fontSize:12,fontWeight:600,color:col,whiteSpace:"nowrap"}}>{s}</span>
        </div>
        {i<steps.length-1&&(<div style={{flex:1,height:2,background:done?C.accent:C.borderLight,margin:"0 4px"}}/>)}
      </div>);
    })}
  </div>);
}

function MeasurementForm(p){
  var mats=p.tab==="opencell"?OPEN_CELL_MATERIALS:p.tab==="closedcell"?CLOSED_CELL_MATERIALS:FIBERGLASS_MATERIALS;
  var isFoam=p.tab==="opencell"||p.tab==="closedcell";
  var hp=p.hasPrice;
  // Allow external lid/cl state (for split layout)
  var s1=useState(""),_lid=s1[0],_setLid=s1[1];
  var s2=useState(""),_cl=s2[0],_setCl=s2[1];
  var lid=p.lid!==undefined?p.lid:_lid;
  var setLid=p.setLid||_setLid;
  var cl=p.cl!==undefined?p.cl:_cl;
  var setCl=p.setCl||_setCl;
  var s3=useState(mats[0]||""),mat=s3[0],setMat=s3[1];
  var s4=useState(0),sqft=s4[0],setSqft=s4[1];
  var s4b=useState(null),wallHeightLabel=s4b[0],setWallHeightLabel=s4b[1];
  var s4c=useState(null),cavityWidth=s4c[0],setCavityWidth=s4c[1];
  var s4d=useState(null),dimStr=s4d[0],setDimStr=s4d[1];
  var s5=useState(""),price=s5[0],setPrice=s5[1];
  var s6=useState("Flat (0/12)"),pitch=s6[0],setPitch=s6[1];
  var s7=useState(0),mk=s7[0],setMk=s7[1];
  var s8=useState(false),isRemoval=s8[0],setIsRemoval=s8[1];
  var s9=useState(""),matNote=s9[0],setMatNote=s9[1];
  var s10=useState(""),tmpMat=s10[0],setTmpMat=s10[1];
  var loc=LOCATIONS.find(function(x){return x.id===lid;});
  var locLabel=loc?(loc.id==="custom"?cl:loc.label):"";
  var locGroup=loc?(loc.id==="custom"?"Other":loc.group):"Other";
  var needsPitch=loc&&loc.type==="roofline"&&(!hp||isFoam);
  var measType=loc?(loc.type==="wall"?"wall":loc.type==="slope"?"slope":"area"):null;
  var pf=needsPitch?(PITCH_FACTORS[pitch]||1):1;
  var adj=sqft*pf;var fin=Math.round(adj);
  var ss={width:"100%",padding:"10px 12px",background:C.input,border:"1px solid "+C.inputBorder,borderRadius:6,color:C.text,fontSize:14,fontFamily:"'Inter',sans-serif",outline:"none",boxSizing:"border-box",WebkitAppearance:"none",transition:"border-color 0.15s"};
  var tabLabel=p.tab==="opencell"?"Open Cell":p.tab==="closedcell"?"Closed Cell":"Fiberglass";
  // Step tracking
  var stepLabels = hp ? ["Location","Material","Measure","Price"] : ["Location","Measure","Material","Add"];
  var stepCurrent = !lid ? 0 : (fin<=0) ? 1 : (!hp&&!matNote.trim()) ? 2 : 3;
  React.useEffect(function(){
    setSqft(0);setWallHeightLabel(null);setCavityWidth(null);setDimStr(null);setMk(function(k){return k+1;});setMatNote("");setTmpMat("");
  },[lid]);
  React.useEffect(function(){
    if(document.getElementById("ist-pulse-style"))return;
    var s=document.createElement("style");s.id="ist-pulse-style";
    s.textContent="@keyframes ist-pulse{0%{box-shadow:0 0 0 0 rgba(37,99,235,0.9),0 0 0 0 rgba(37,99,235,0.5)}60%{box-shadow:0 0 0 6px rgba(37,99,235,0.3),0 0 0 12px rgba(37,99,235,0)}100%{box-shadow:0 0 0 0 rgba(37,99,235,0),0 0 0 0 rgba(37,99,235,0)}}.ist-pulse{animation:ist-pulse 1.3s ease-in-out infinite !important;border-radius:8px;outline:2px solid rgba(37,99,235,0.6);outline-offset:1px;}.ist-pulse-selected{animation:ist-pulse 1.3s ease-in-out infinite !important;}";
    document.head.appendChild(s);
  },[]);
  function handleAdd(){
    var pr=hp?(parseFloat(price)||0):0;if(fin<=0||!locLabel)return;if(hp&&pr<=0)return;if(!hp&&!matNote.trim()){alert("Please select a material first.");return;}
    var useMat=hp?mat:"(material TBD)";
    var desc=hp?("Install "+mat.toLowerCase()+" in "+locLabel.toLowerCase()):(locLabel+" — "+fin.toLocaleString()+" sq ft");
    p.onAdd({type:isFoam?"Foam":"Fiberglass",material:useMat,location:locLabel,locationId:loc?loc.id:"custom",group:locGroup,sqft:fin,pitch:needsPitch?pitch:null,pricePerUnit:pr,total:hp?Math.ceil(fin*pr):0,description:desc,isRemoval:!hp&&isRemoval,wallHeightLabel:(!hp&&wallHeightLabel)||null,cavityWidth:(!hp&&cavityWidth)||null,matNote:(!hp&&matNote.trim())||null,dimStr:dimStr||null});
    setSqft(0);setWallHeightLabel(null);setCavityWidth(null);setDimStr(null);setPrice("");setPitch("Flat (0/12)");setMk(function(k){return k+1;});setIsRemoval(false);setMatNote("");setTmpMat("");
  }
  return(<div style={{background:"rgba(255,255,255,0.65)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderRadius:12,padding:18,border:"1px solid rgba(255,255,255,0.8)",boxShadow:"0 4px 24px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.9)"}}>
    <StepBar steps={stepLabels} current={stepCurrent}/>
    {/* STEP 1: Location grid */}
    {!p.hideLocation&&(<div style={{marginBottom:16}}>
      <div style={{fontSize:11,fontWeight:700,color:C.textSec,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>{"① Location"}</div>
      <LocationGrid pulse={!hp&&stepCurrent===0} value={lid} onChange={function(v){setLid(v);setSqft(0);setMk(function(k){return k+1;});}}/>
      {lid==="custom"&&(<div style={{marginTop:8}}><QV_Input label="Custom Location Name" value={cl} onChange={setCl} type="text" placeholder="e.g. Bonus room walls"/></div>)}
    </div>)}
    {loc&&(<div>
      {hp&&(<div style={{marginBottom:14}}>
        <div style={{fontSize:11,fontWeight:700,color:C.textSec,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>{"② Material"}{!mat&&(<span style={{color:C.danger,marginLeft:4}}>{"*"}</span>)}</div>
        {(function(){
          var HPBTNS=[
            {id:"R11",label:"R11",value:"R11 Fiberglass Batts",sub:null},
            {id:"R13",label:"R13",value:null,sub:[{id:"x15",label:"x15",value:"R13 x15 Fiberglass Batts"},{id:"x24",label:"x24",value:"R13 x24 Fiberglass Batts"}]},
            {id:"R19",label:"R19",value:null,sub:[{id:"x15",label:"x15",value:"R19 x15 Fiberglass Batts"},{id:"x24",label:"x24",value:"R19 x24 Fiberglass Batts"}]},
            {id:"R30",label:"R30",value:null,sub:[{id:"x15",label:"x15",value:"R30 x15 Fiberglass Batts"},{id:"x24",label:"x24",value:"R30 x24 Fiberglass Batts"}]},
            {id:"opencell",label:"Open Cell",value:null,sub:["2\"","3\"","4\"","5\"","6\""].map(function(v){return{id:v,label:v,value:v+' Open Cell Foam'};})},
            {id:"closedcell",label:"Closed Cell",value:null,sub:["1\"","2\"","3\""].map(function(v){return{id:v,label:v,value:v+' Closed Cell Foam'};})},
            {id:"blownfg",label:"Blown Fiberglass",value:null,sub:["R13","R15","R19","R22","R26","R30","R38","R44","R49","R60"].map(function(r){return{id:r,label:r,value:"Blown Fiberglass "+r};})},
            {id:"blowncel",label:"Blown Cellulose",value:null,sub:["R13","R15","R19","R22","R26","R30","R38","R44","R49","R60"].map(function(r){return{id:r,label:r,value:"Blown Cellulose "+r};})},
          ];
          var hpBtnStyle=function(active){return{padding:"8px 13px",borderRadius:8,border:active?"2px solid "+C.accent:"1px solid rgba(0,0,0,0.08)",background:active?"rgba(37,99,235,0.1)":"rgba(255,255,255,0.6)",color:active?C.accent:C.text,fontSize:13,fontWeight:active?700:500,cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.12s",backdropFilter:"blur(8px)",boxShadow:active?"0 0 0 3px rgba(37,99,235,0.1)":"0 1px 3px rgba(0,0,0,0.06)"};};
          var activePrimary=HPBTNS.find(function(b){return mat&&(b.value===mat||b.sub&&b.sub.some(function(s){return s.value===mat;}));});
          var activePrimaryId=activePrimary?activePrimary.id:"";
          return React.createElement("div",null,
            React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}},
              HPBTNS.map(function(b){
                var active=activePrimaryId===b.id;
                return React.createElement("button",{key:b.id,onClick:function(){if(b.value){setMat(b.value);}else{setMat("");}setTmpMat(b.id);},style:hpBtnStyle(active)},b.label);
              })
            ),
            activePrimary&&activePrimary.sub&&React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:6,marginTop:4,paddingLeft:8,borderLeft:"3px solid "+C.accent}},
              activePrimary.sub.map(function(s){
                var subActive=mat===s.value;
                return React.createElement("button",{key:s.id,onClick:function(){setMat(s.value);},style:hpBtnStyle(subActive)},s.label);
              })
            )
          );
        })()}
        {mat&&(<div style={{marginTop:6,fontSize:12,color:C.accent,fontWeight:600}}>{"✓ "+mat}</div>)}
      </div>)}
      <div style={{marginBottom:4}}>
        <div style={{fontSize:11,fontWeight:700,color:C.textSec,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>{(hp?"③":"②")+" Measurements"}</div>
      </div>
      {measType==="wall"?(<WallMeasurement key={"w-"+mk} pulse={!hp&&stepCurrent===1} lhOnly={lid==="ext_kneewall"||lid==="attic_kneewall"} onSqftChange={function(s,h,cw,ds){setSqft(s);setWallHeightLabel(h||null);setCavityWidth(cw||null);setDimStr(ds||null);}}/>):measType==="slope"?(<WallMeasurement key={"w-"+mk} pulse={!hp&&stepCurrent===1} onSqftChange={function(s,h,cw,ds){setSqft(s);setDimStr(ds||null);}} lhOnly/>):(<AreaMeasurement key={"a-"+mk} pulse={!hp&&stepCurrent===1} onSqftChange={function(s,h,cw,ds){setSqft(s);setDimStr(ds||null);}}/>)}
      {needsPitch&&(<div style={{marginBottom:10}}><AppSelect label="Roof Pitch" value={pitch} onChange={setPitch} options={Object.keys(PITCH_FACTORS)}/></div>)}
      {!hp&&(<div style={{marginBottom:12}}>
        <div style={{fontSize:11,fontWeight:700,color:C.accent,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>{"③ Material"}{!matNote.trim()&&(<span style={{color:C.danger,marginLeft:4}}>{"*"}</span>)}</div>
        {(function(){
          var BTNS=[
            {id:"R11",label:"R11",value:"R11 Fiberglass Batts",sub:null},
            {id:"R13",label:"R13",value:null,sub:[{id:"x15",label:"x15",value:"R13 x15 Fiberglass Batts"},{id:"x24",label:"x24",value:"R13 x24 Fiberglass Batts"}]},
            {id:"R19",label:"R19",value:null,sub:[{id:"x15",label:"x15",value:"R19 x15 Fiberglass Batts"},{id:"x24",label:"x24",value:"R19 x24 Fiberglass Batts"}]},
            {id:"R30",label:"R30",value:null,sub:[{id:"x15",label:"x15",value:"R30 x15 Fiberglass Batts"},{id:"x24",label:"x24",value:"R30 x24 Fiberglass Batts"}]},
            {id:"opencell",label:"Open Cell",value:null,sub:["1\"","2\"","3\"","4\"","5\"","6\"","7\"","8\"","9\"","10\""].map(function(v){return{id:v,label:v,value:v+' Open Cell Foam'};})},
            {id:"closedcell",label:"Closed Cell",value:null,sub:["1\"","1.5\"","2\"","2.5\"","3\"","3.5\"","4\"","4.5\"","5\"","5.5\"","6\""].map(function(v){return{id:v,label:v,value:v+' Closed Cell Foam'};})},
            {id:"blownfg",label:"Blown Fiberglass",value:null,sub:["R13","R15","R19","R22","R26","R30","R38","R44","R49","R60"].map(function(r){return{id:r,label:r,value:"Blown Fiberglass "+r};})},
            {id:"blowncel",label:"Blown Cellulose",value:null,sub:["R13","R15","R19","R22","R26","R30","R38","R44","R49","R60"].map(function(r){return{id:r,label:r,value:"Blown Cellulose "+r};})},
            {id:"removal",label:"Removal",value:"Removal",sub:null,isRemoval:true},
          ];
          var btnStyle=function(active,rem){return{padding:"8px 13px",borderRadius:8,border:active?(rem?"2px solid "+C.danger:"2px solid "+C.accent):"1px solid rgba(0,0,0,0.08)",background:active?(rem?"rgba(220,38,38,0.1)":"rgba(37,99,235,0.1)"):"rgba(255,255,255,0.6)",color:active?(rem?C.danger:C.accent):C.text,fontSize:13,fontWeight:active?700:500,cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.12s",backdropFilter:"blur(8px)",boxShadow:active?(rem?"0 0 0 3px rgba(220,38,38,0.1)":"0 0 0 3px rgba(37,99,235,0.1)"):"0 1px 3px rgba(0,0,0,0.06)"};};
          var matPulse=stepCurrent===2;
          var activeBtn=BTNS.find(function(b){return b.id===tmpMat;});
          var subPulse=matPulse&&activeBtn&&activeBtn.sub&&!matNote.trim();
          return React.createElement("div",null,
            React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}},
              BTNS.map(function(b){
                var active=tmpMat===b.id;
                var shouldPulse=matPulse&&!tmpMat;
                return React.createElement("button",{key:b.id,className:shouldPulse||active?"ist-pulse":"",onClick:function(){
                  setTmpMat(b.id);
                  if(b.value){setMatNote(b.value);}else{setMatNote("");}
                  setIsRemoval(!!b.isRemoval);
                },style:btnStyle(active,b.isRemoval)},b.label);
              })
            ),
            activeBtn&&activeBtn.sub&&React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:6,marginTop:4,paddingLeft:8,borderLeft:"3px solid "+C.accent}},
              activeBtn.sub.map(function(s){
                var subActive=matNote===s.value;
                return React.createElement("button",{key:s.id,className:subPulse||subActive?"ist-pulse":"",onClick:function(){setMatNote(s.value);},style:btnStyle(subActive)},s.label);
              })
            )
          );
        })()}
        {matNote.trim()&&(<div style={{marginTop:8,fontSize:12,color:C.accent,fontWeight:600}}>{"✓ "+matNote}</div>)}
      </div>)}
      {hp&&(<div style={{marginBottom:14}}>
        <div style={{fontSize:11,fontWeight:700,color:C.textSec,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>{(hp?"④":"③")+" Price"}</div>
        <QV_Input label="Price per Sq Ft" value={price} onChange={setPrice} placeholder="$0.00" step="0.01"/>
      </div>)}
      {fin>0&&(<div style={{background:C.accentBg,borderRadius:6,padding:12,marginBottom:12,fontSize:13,color:C.textSec,border:"1px solid "+C.borderLight}}>
        <div style={{fontWeight:600,color:C.text,marginBottom:4,fontSize:14}}>{hp?("Install "+mat.toLowerCase()+" in "+locLabel.toLowerCase()):(locLabel+" — "+fin.toLocaleString()+" sq ft")}</div>
        <div>{"Total: "}<span style={{color:C.text,fontWeight:600}}>{fin.toLocaleString()+" sq ft"}</span>{needsPitch&&sqft!==adj&&(<span>{" (adj. from "+Math.round(sqft)+" w/ "+pitch+")"}</span>)}</div>
        {hp&&(parseFloat(price)||0)>0&&(<div>{"Line Total: "}<span style={{color:C.accent,fontWeight:700}}>{"$"+Math.ceil(fin*(parseFloat(price)||0)).toLocaleString()+".00"}</span></div>)}
      </div>)}
      {!hp&&fin>0&&false&&(<label style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",marginBottom:8,cursor:"pointer"}}>
        <input type="checkbox" checked={isRemoval} onChange={function(e){setIsRemoval(e.target.checked);}} style={{width:18,height:18,accentColor:C.accent,cursor:"pointer"}}/>
        <span style={{fontSize:13,fontWeight:600,color:C.text}}>{"Removal"}</span>
      </label>)}
      <GreenBtn pulse={!hp&&stepCurrent===3} onClick={handleAdd}>{"+ "+(hp?"Add to Quote":"Add Measurement")}</GreenBtn>
    </div>)}
  </div>);
}

function MaterialTabs(p){return(<div style={{display:"flex",gap:0,borderRadius:6,overflow:"hidden",border:"1px solid "+C.border,marginBottom:16}}>{[{id:"fiberglass",label:"FIBERGLASS"},{id:"opencell",label:"OPEN CELL"},{id:"closedcell",label:"CLOSED CELL"}].map(function(t){return(<button key={t.id} onClick={function(){p.setActiveTab(t.id);}} style={{flex:1,padding:"12px 4px",border:"none",cursor:"pointer",fontFamily:"'Inter',sans-serif",fontSize:11,fontWeight:700,letterSpacing:"0.04em",textTransform:"uppercase",background:p.activeTab===t.id?C.accent:C.card,color:p.activeTab===t.id?"#fff":C.dim}}>{t.label}</button>);})}</div>);}

function getSavedCustomers(salesman){try{return JSON.parse(localStorage.getItem("ist-customers-"+salesman)||"[]");}catch(e){return[];}}
function setSavedCustomers(salesman,list){localStorage.setItem("ist-customers-"+salesman,JSON.stringify(list));}

function SavedDropdown({label, icon, color, bg, items, onSelect, onDelete}){
  var s1=useState(false),open=s1[0],setOpen=s1[1];
  var s2=useState(""),q=s2[0],setQ=s2[1];
  var sorted=items.filter(function(c){return!q||c.name.toLowerCase().indexOf(q.toLowerCase())>=0;}).sort(function(a,b){return a.name.localeCompare(b.name);});
  return(
    <div style={{flex:1,position:"relative"}}>
      {open&&<div onClick={function(){setOpen(false);setQ("");}} style={{position:"fixed",inset:0,zIndex:998}}/>}
      <button onClick={function(){setOpen(!open);}} style={{width:"100%",padding:"9px 12px",borderRadius:6,border:"1px solid "+color,background:open?color:bg,color:open?"#fff":color,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",display:"flex",justifyContent:"space-between",alignItems:"center",gap:4}}>
        <span>{icon} {label} ({items.length})</span><span style={{fontSize:11}}>{open?"▲":"▼"}</span>
      </button>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:"rgba(255,255,255,0.92)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",border:"1px solid rgba(0,0,0,0.1)",borderRadius:8,boxShadow:"0 8px 32px rgba(0,0,0,0.15)",zIndex:9999,minWidth:200}}>
          <input autoFocus value={q} onChange={function(e){setQ(e.target.value);}} placeholder={"Search "+label+"..."} style={{width:"100%",padding:"8px 12px",border:"none",borderBottom:"1px solid #e5e7eb",borderRadius:"8px 8px 0 0",fontSize:13,fontFamily:"'Inter',sans-serif",boxSizing:"border-box",outline:"none"}}/>
          <div style={{maxHeight:220,overflowY:"auto"}}>
            {sorted.length===0
              ?<div style={{padding:"12px",fontSize:13,color:"#9ca3af"}}>No {label.toLowerCase()} saved</div>
              :sorted.map(function(c){return(
                <div key={c.name} onClick={function(){onSelect(c);setOpen(false);setQ("");}} style={{padding:"10px 12px",borderBottom:"1px solid #f3f4f6",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:"#111"}}>{c.name}</div>
                    {c.address&&<div style={{fontSize:11,color:"#6b7280"}}>{c.address}</div>}
                    {c.phone&&<div style={{fontSize:11,color:"#6b7280"}}>{c.phone}</div>}
                  </div>
                  <button onClick={function(e){e.stopPropagation();onDelete(c.name);}} style={{padding:"3px 7px",borderRadius:4,border:"1px solid #fca5a5",background:"#fef2f2",color:"#dc2626",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",flexShrink:0,marginLeft:8}}>✕</button>
                </div>
              );})}
          </div>
        </div>
      )}
    </div>
  );
}

function CustomerInfo(p){
  var user=p.currentUser||"default";
  var s1=useState(false),showForm=s1[0],setShowForm=s1[1];
  var s2=useState(""),search=s2[0],setSearch=s2[1];
  var s3=useState(false),showDrop=s3[0],setShowDrop=s3[1];
  var s4=useState(getSavedCustomers(user)),saved=s4[0],setSaved=s4[1];
  var s5=useState("Individual"),custType=s5[0],setCustType=s5[1];

  var builders=saved.filter(function(c){return(c.type||"Individual")==="Builder";});
  var individuals=saved.filter(function(c){return(c.type||"Individual")==="Individual";});

  function load(c){p.setCustName(c.name||"");p.setCustAddr(c.address||"");p.setCustPhone(c.phone||"");p.setCustEmail(c.email||"");p.setJobAddr(c.jobAddress||"");setCustType(c.type||"Individual");}

  function del(name){
    if(!confirm("Remove "+name+"?"))return;
    var list=getSavedCustomers(user).filter(function(c){return c.name!==name;});
    setSavedCustomers(user,list);setSaved(list);
  }

  function save(){
    if(!p.custName.trim()){alert("Enter a customer name first.");return;}
    var entry={name:p.custName.trim(),address:p.custAddr,phone:p.custPhone,email:p.custEmail,jobAddress:p.jobAddr,type:custType};
    var list=getSavedCustomers(user);
    var idx=list.findIndex(function(c){return c.name.toLowerCase()===entry.name.toLowerCase();});
    if(idx>=0){if(!confirm("Update saved info for "+entry.name+"?"))return;list[idx]=entry;}else{list.push(entry);}
    setSavedCustomers(user,list);setSaved(list);
    alert(entry.name+" saved!");
  }

  var s6=useState(false),open=s6[0],setOpen=s6[1];
  return(<div style={{padding:"0 16px 12px"}}>
    <div style={{background:"rgba(255,255,255,0.65)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderRadius:12,border:"1px solid rgba(255,255,255,0.8)",boxShadow:"0 4px 24px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.9)",marginBottom:10,overflow:"visible"}}>
      <button onClick={function(){setOpen(!open);}} style={{width:"100%",padding:"10px 14px",background:"#1e293b",display:"flex",justifyContent:"space-between",alignItems:"center",borderRadius:open?"8px 8px 0 0":"8px",border:"none",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
        <span style={{fontSize:12,fontWeight:800,color:"#fff",textTransform:"uppercase",letterSpacing:0.8}}>👤 Customer Info</span>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {p.custName&&<span style={{fontSize:13,fontWeight:600,color:"#93c5fd"}}>{p.custName}</span>}
          <span style={{fontSize:13,color:"rgba(255,255,255,0.6)"}}>{open?"▲":"▼"}</span>
        </div>
      </button>

      {open&&<>{/* Two dropdowns side by side */}
      <div style={{padding:"10px 12px",display:"flex",gap:8,borderBottom:"1px solid "+C.border}}>
        <SavedDropdown label="Builders" icon="🏗️" color="#2563eb" bg="#eff6ff" items={builders} onSelect={load} onDelete={del}/>
        <SavedDropdown label="Individuals" icon="👤" color="#7c3aed" bg="#f5f3ff" items={individuals} onSelect={load} onDelete={del}/>
      </div>

      {/* Always-visible form */}
      <div style={{padding:14}}>
        <div style={{marginBottom:10}}><QV_Input label="Customer Name" value={p.custName} onChange={p.setCustName} type="text" placeholder="John Doe"/></div>
        <div style={{marginBottom:10}}>
          <QV_Input label="Address" value={p.custAddr} onChange={p.setCustAddr} type="text" placeholder="123 Main St, Tulsa OK"/>
          <button onClick={function(){var addr=(p.custAddr||"").trim();if(!addr){alert("Enter an address first.");return;}window.open("https://assessor.tulsacounty.org/Property/Search?terms="+encodeURIComponent(addr),"_blank");}} style={{marginTop:6,padding:"6px 12px",borderRadius:6,border:"1px solid #2563eb",background:"#eff6ff",color:"#2563eb",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>Look Up on Tulsa County Assessor</button>
        </div>
        <Row><Col><QV_Input label="Phone" value={p.custPhone} onChange={p.setCustPhone} type="tel" placeholder="(918) 555-0000"/></Col><Col><QV_Input label="Email" value={p.custEmail} onChange={p.setCustEmail} type="email" placeholder="john@email.com"/></Col></Row>
        <div style={{marginTop:10}}><QV_Input label="Job Site (if different)" value={p.jobAddr} onChange={p.setJobAddr} type="text" placeholder="456 Oak Ave"/></div>

        {/* Save controls — optional */}
        <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid "+C.border}}>
          <label style={{fontSize:10,fontWeight:700,color:C.textSec,textTransform:"uppercase",letterSpacing:"0.08em",display:"block",marginBottom:6}}>Save to List (Optional)</label>
          <div style={{display:"flex",gap:8}}>
            {["Builder","Individual"].map(function(type){return(
              <button key={type} onClick={function(){setCustType(type);}} style={{flex:1,padding:"7px",borderRadius:6,border:"1px solid "+(custType===type?(type==="Builder"?"#2563eb":"#7c3aed"):C.border),background:custType===type?(type==="Builder"?"#eff6ff":"#f5f3ff"):"transparent",color:custType===type?(type==="Builder"?"#2563eb":"#7c3aed"):C.dim,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                {type==="Builder"?"🏗️ Builder":"👤 Individual"}
              </button>
            );})}
            <button onClick={save} style={{flex:1,padding:"7px",borderRadius:6,border:"1px solid #16a34a",background:"#f0fdf4",color:"#16a34a",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>💾 Save</button>
            <button onClick={function(){if(confirm("Clear?")){p.setCustName("");p.setCustAddr("");p.setCustPhone("");p.setCustEmail("");p.setJobAddr("");}}} style={{padding:"7px 12px",borderRadius:6,border:"1px solid "+C.danger,background:"transparent",color:C.danger,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>✕</button>
          </div>
        </div>
      </div>
      </>}
    </div>
  </div>);
}

function groupMeasurements(items){var g={};items.forEach(function(m){var k=m.group||"Other";if(!g[k])g[k]=[];g[k].push(m);});return g;}

/* ──────── PRINT / DOWNLOAD FUNCTIONS ──────── */

function buildSalesmanBlock(salesman){
  var s=SALESMAN_INFO[salesman];if(!s)return "";
  return '<div style="margin-top:30px;display:inline-block;padding:10px 16px;background:#f5f5f5;border:2px solid #222;border-radius:6px"><div style="font-size:9px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px">Your Sales Representative</div><div style="font-size:16px;font-weight:800;color:#111;margin-bottom:4px">'+s.fullName+'</div><div style="font-size:13px;color:#111;font-weight:600;margin-bottom:2px">📞 '+s.phone+'</div><div style="font-size:13px;color:#111;font-weight:600">✉ '+s.email+'</div></div>';
}

function buildTakeOffHtml(customer,jobNotes,measurements,salesman,quoteOpts){
  var groups=groupMeasurements(measurements);var sorted=GROUP_ORDER.filter(function(g){return groups[g];});
  var total=measurements.reduce(function(s,m){return s+m.sqft;},0);
  var today=new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});
  var notesHtml=jobNotes?'<div style="margin-bottom:20px;padding:12px 14px;background:#f9f9f9;border:1px solid #ddd;border-radius:6px"><div style="font-size:10px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px">Job Notes</div><div style="font-size:13px;color:#333;white-space:pre-wrap;line-height:1.5">'+jobNotes.replace(/</g,"&lt;").replace(/>/g,"&gt;")+'</div></div>':"";
  var ghtml=sorted.map(function(gn){var gt=groups[gn].reduce(function(s,m){return s+m.sqft;},0);
    var rows=groups[gn].map(function(item){return '<tr style="border-bottom:1px solid #e0e0e0"><td style="padding:8px 10px;font-size:13px;color:#333">'+item.location+'</td><td style="padding:8px 10px;font-size:13px;color:#333;text-align:right;font-weight:600">'+item.sqft.toLocaleString()+' sf</td></tr>';}).join("");
    return '<div style="margin-bottom:20px"><div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:#f5f5f5;border:1px solid #ddd;border-bottom:2px solid #333;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#333"><span>'+gn+'</span><span>'+gt.toLocaleString()+' sq ft</span></div><table style="width:100%;border-collapse:collapse"><tbody>'+rows+'</tbody></table></div>';}).join("");
  var si=SALESMAN_INFO[salesman];
  var salesHtml=si?'<div style="text-align:right"><div style="font-size:10px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px">Your Sales Rep</div><div style="font-size:15px;font-weight:800;color:#111;margin-bottom:2px">'+si.fullName+'</div><div style="font-size:13px;color:#111;font-weight:600;margin-bottom:1px">'+si.phone+'</div><div style="font-size:13px;color:#111;font-weight:600">'+si.email+'</div></div>':'';
  var totalRow=measurements.length>0?'<div style="margin-top:24px;padding-top:16px;border-top:2px solid #111;display:flex;justify-content:space-between;align-items:center"><div style="font-size:14px;font-weight:800;text-transform:uppercase;color:#111">Total</div><div style="font-size:18px;font-weight:800;color:#111">'+total.toLocaleString()+' sq ft</div></div>':'';
  return '<div style="font-family:Arial,sans-serif;color:#1a1a1a;padding:24px;max-width:100%;margin:0;width:100%;box-sizing:border-box">'+
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #111"><div><h1 style="font-size:22px;font-weight:800;color:#111;margin-bottom:2px">'+COMPANY.name+'</h1><p style="font-size:12px;color:#888">'+COMPANY.tagline+'</p></div><div style="text-align:right"><div style="font-size:18px;font-weight:800;color:#111;text-transform:uppercase">Take Off</div><div style="font-size:12px;color:#888;margin-top:2px">'+today+'</div></div></div>'+
    '<div style="display:flex;justify-content:space-between;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #ddd"><div style="flex:1"><div style="font-size:10px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px">Customer</div><div style="font-size:15px;font-weight:600">'+(customer.name||"—")+'</div><div style="font-size:13px;color:#666">'+(customer.address||"")+'</div><div style="font-size:13px;color:#666">'+(customer.phone||"")+'</div><div style="font-size:13px;color:#666">'+(customer.email||"")+'</div></div><div style="flex:1"><div style="font-size:10px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px">Job Site</div><div style="font-size:15px;font-weight:600">'+(customer.jobAddress||customer.address||"—")+'</div></div>'+salesHtml+'</div>'+
    notesHtml+
    ghtml+totalRow+
    (function(){
      if(!quoteOpts||quoteOpts.length===0)return"";
      var rows=quoteOpts.map(function(opt,idx){
        var lines=[];
        // Line items with price per sq ft
        if(opt.items&&opt.items.length>0){
          opt.items.forEach(function(item){
            if(!item.sqft||!item.pricePerUnit)return;
            lines.push('<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:5px 0;border-bottom:1px solid #eee"><span style="font-size:13px;color:#333">'+item.location+(item.description?' <span style="color:#666;font-size:11px">('+item.description+')</span>':'')+'</span><span style="font-size:13px;font-weight:700;color:#333;text-align:right;white-space:nowrap;margin-left:12px">'+item.sqft.toLocaleString()+' sf @ $'+parseFloat(item.pricePerUnit).toFixed(2)+'/sf = $'+Math.ceil(item.sqft*item.pricePerUnit).toLocaleString()+'</span></div>');
          });
          if(lines.length>0)lines.push('<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:2px solid #d1d5db;margin-bottom:4px"><span style="font-size:12px;font-weight:700;color:#666">Total before adders</span><span style="font-size:13px;font-weight:800;color:#111">$'+(opt.overrideTotal?parseFloat(opt.overrideTotal).toLocaleString():opt.items.reduce(function(s,i){return s+i.total;},0).toLocaleString())+'</span></div>');
        }
        if(opt.pso)lines.push('<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #eee"><span style="font-size:13px;color:#333">PSO Credit Attic</span><span style="font-size:13px;font-weight:700;color:#dc2626">-$600</span></div>');
        if(opt.psoKw)lines.push('<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #eee"><span style="font-size:13px;color:#333">PSO Credit KW</span><span style="font-size:13px;font-weight:700;color:#dc2626">-$525</span></div>');
        if(opt.extraLabor&&opt.extraLaborAmt)lines.push('<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #eee"><span style="font-size:13px;color:#333">Extra Labor</span><span style="font-size:13px;font-weight:700;color:#333">$'+parseFloat(opt.extraLaborAmt).toFixed(0)+'</span></div>');
        if(opt.tripCharge&&opt.tripChargeAmt)lines.push('<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #eee"><span style="font-size:13px;color:#333">Trip Charge</span><span style="font-size:13px;font-weight:700;color:#333">$'+parseFloat(opt.tripChargeAmt).toFixed(0)+'</span></div>');
        if(opt.energySeal&&opt.energySealAmt)lines.push('<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #eee"><span style="font-size:13px;color:#333">Energy Seal & Plates</span><span style="font-size:13px;font-weight:700;color:#333">$'+parseFloat(opt.energySealAmt).toFixed(0)+'</span></div>');
        if(opt.dumpster&&opt.dumpsterAmt)lines.push('<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #eee"><span style="font-size:13px;color:#333">Dumpster</span><span style="font-size:13px;font-weight:700;color:#333">$'+parseFloat(opt.dumpsterAmt).toFixed(0)+'</span></div>');
        if(lines.length===0)return"";
        var header=quoteOpts.length>1?'<div style="font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px">'+opt.name+'</div>':"";
        return header+lines.join("");
      }).join("");
      if(!rows)return"";
      return '<div style="margin-top:24px;padding:14px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px"><div style="font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px">⚠ Internal Adders — Do Not Share With Customer</div>'+rows+'</div>';
    })()+
    '<div style="margin-top:20px;padding-top:16px;border-top:1px solid #ddd;font-size:11px;color:#999;text-align:center">'+COMPANY.name+' &bull; '+COMPANY.phone+'<br/>Helping Oklahoma stay energy efficient—one home at a time.</div></div>';
}



/* ══════════ TAKE OFF ══════════ */

function TakeOff(p){
  var ls=useState(""),lid=ls[0],setLid=ls[1];
  var cs=useState(""),cl=cs[0],setCl=cs[1];
  function addM(item){
    p.setMeasurements(function(prev){
      return prev.concat([Object.assign({},item,{id:Date.now()+Math.random()})]);
    });
  }
  function removeM(id){p.setMeasurements(function(prev){return prev.filter(function(m){return m.id!==id;});});}
  var regularItems=p.measurements.filter(function(m){return !m.isRemoval;});
  var removalItems=p.measurements.filter(function(m){return m.isRemoval;});
  var groups=groupMeasurements(regularItems);var sorted=GROUP_ORDER.filter(function(g){return groups[g];});
  var total=p.measurements.reduce(function(s,m){return s+m.sqft;},0);
  var removalTotal=removalItems.reduce(function(s,m){return s+m.sqft;},0);
  return(<div>
    <CustomerInfo custName={p.custName} setCustName={p.setCustName} custAddr={p.custAddr} setCustAddr={p.setCustAddr} custPhone={p.custPhone} setCustPhone={p.setCustPhone} custEmail={p.custEmail} setCustEmail={p.setCustEmail} jobAddr={p.jobAddr} setJobAddr={p.setJobAddr} currentUser={p.currentUser}/>
    {/* Row 1: Location (left) | Measurement inputs (right) */}
    <div className="ist-2col" style={{marginBottom:0}}>
      <div className="ist-col-form">
        <div style={{padding:"0 16px 12px"}}>
          <div style={{fontSize:11,fontWeight:700,color:C.accent,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>{"① Location"}</div>
          <LocationGrid pulse={!lid} value={lid} onChange={function(v){setLid(v);}}/>
          {lid==="custom"&&(<div style={{marginTop:8}}><QV_Input label="Custom Location Name" value={cl} onChange={setCl} type="text" placeholder="e.g. Bonus room walls"/></div>)}
        </div>
      </div>
      <div className="ist-col-results">
        <div style={{padding:"0 16px 12px"}}>
          <div style={{fontSize:11,fontWeight:700,color:C.accent,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>{"② Measure & Add"}</div>
          <MeasurementForm key={"to-takeoff"} lid={lid} setLid={setLid} cl={cl} setCl={setCl} tab={"fiberglass"} onAdd={addM} hasPrice={false} hideLocation/>
        </div>
      </div>
    </div>

    {/* Row 2: Job Notes (left) | Takeoff list (right) */}
    <div className="ist-2col" style={{alignItems:"flex-start"}}>

      {/* Left: Job Notes + Print/Share */}
      <div className="ist-col-form">
        <div style={{padding:"0 16px 12px"}}>
          <div style={{fontSize:11,fontWeight:700,color:C.accent,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>{"Job Notes"}</div>
          <textarea style={{width:"100%",padding:"10px 12px",background:C.input,border:"1px solid "+C.inputBorder,borderRadius:6,color:C.text,fontSize:14,fontFamily:"'Inter',sans-serif",outline:"none",boxSizing:"border-box",minHeight:80,resize:"vertical",transition:"border-color 0.15s"}} onFocus={function(e){e.target.style.borderColor=C.accent;}} onBlur={function(e){e.target.style.borderColor=C.inputBorder;}} value={p.jobNotes} onChange={function(e){p.setJobNotes(e.target.value);}} placeholder="e.g. 2-story, 4/12 pitch, no garage..."/>
        </div>
        <div style={{padding:"0 16px"}}>
          <GreenBtn onClick={function(){var cust={name:p.custName,address:p.custAddr,phone:p.custPhone,email:p.custEmail,jobAddress:p.jobAddr||p.custAddr};import("./takeoffPdf.js").then(function(mod){mod.printTakeOff(cust,p.jobNotes,p.measurements,p.currentUser,p.quoteOpts);});}}>{"Print Take Off"}</GreenBtn>
          <GreenBtn mt={8} onClick={function(){var cust={name:p.custName,address:p.custAddr,phone:p.custPhone,email:p.custEmail,jobAddress:p.jobAddr||p.custAddr};import("./takeoffPdf.js").then(function(mod){mod.shareTakeOff(cust,p.jobNotes,p.measurements,p.currentUser,p.quoteOpts);});}}>{"Share Take Off"}</GreenBtn>
          {p.measurements.length>0&&(<>
            <GreenBtn mt={8} onClick={p.onSendToQuote}>{"Send to Quote Builder"}</GreenBtn>
            <GreenBtn mt={8} onClick={p.onSendToWorkOrder}>{"Send to Work Order"}</GreenBtn>
            <button onClick={function(){if(confirm("Clear all measurements?"))p.setMeasurements([]);}} style={{width:"100%",marginTop:8,padding:"10px",borderRadius:6,border:"1px solid "+C.danger,background:"transparent",color:C.danger,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif",textTransform:"uppercase"}}>{"Clear All"}</button>
          </>)}
        </div>
      </div>

      {/* Right: Takeoff list */}
      <div className="ist-col-results">
        <div style={{padding:"0 16px"}}>
        {p.measurements.length>0&&(<div>
          <div style={{fontSize:12,fontWeight:700,color:C.accent,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:14}}>{"Take Off ("+p.measurements.length+" items · "+total.toLocaleString()+" sq ft)"}</div>
          {sorted.map(function(gn){var gt=groups[gn].reduce(function(s,m){return s+m.sqft;},0);
            return(<div key={gn} style={{marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:700,color:C.dim,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8,paddingBottom:6,borderBottom:"1px solid "+C.border}}>{gn}<span style={{color:C.accent,marginLeft:8}}>{gt.toLocaleString()+" sq ft"}</span></div>
              <div style={{background:"rgba(255,255,255,0.06)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",borderRadius:10,border:"1px solid rgba(255,255,255,0.1)",overflow:"hidden",boxShadow:"0 4px 24px rgba(0,0,0,0.4)"}}>
                {groups[gn].map(function(item,idx){return(<div key={item.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",borderBottom:idx<groups[gn].length-1?"1px solid "+C.borderLight:"none"}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:600,lineHeight:1.3,color:C.text}}>{item.location}</div>
                    {item.wallHeightLabel&&(<div style={{fontSize:12,color:C.accent,marginTop:2,fontWeight:500}}>{"↳ "+item.wallHeightLabel}</div>)}
                    {item.cavityWidth&&(<div style={{fontSize:12,color:C.textSec,marginTop:2,fontWeight:500}}>{"↳ "+item.cavityWidth+" cavity"}</div>)}
                    {item.matNote&&(<div style={{fontSize:12,color:C.dim,marginTop:2}}>{"📋 "+item.matNote}</div>)}
                    {item.pitch&&(<div style={{fontSize:12,color:C.dim,marginTop:2}}>{item.pitch}</div>)}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:12,marginLeft:12}}><div style={{fontSize:14,fontWeight:700,color:C.text}}>{item.sqft.toLocaleString()+" sf"}</div><button onClick={function(){removeM(item.id);}} style={{background:"none",border:"none",color:C.danger,fontSize:11,cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:600}}>{"Remove"}</button></div>
                </div>);})}
              </div>
            </div>);
          })}
          {removalItems.length>0&&(<div style={{marginBottom:16}}>
            <div style={{fontSize:11,fontWeight:700,color:C.danger,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8,paddingBottom:6,borderBottom:"1px solid "+C.danger}}>{"Removal"}<span style={{color:C.danger,marginLeft:8}}>{removalTotal.toLocaleString()+" sq ft"}</span></div>
            <div style={{background:C.card,borderRadius:6,border:"1px solid "+C.danger,overflow:"hidden",boxShadow:C.shadow}}>
              {removalItems.map(function(item,idx){return(<div key={item.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",borderBottom:idx<removalItems.length-1?"1px solid "+C.borderLight:"none"}}>
                <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,lineHeight:1.3,color:C.text}}>{item.location}</div></div>
                <div style={{display:"flex",alignItems:"center",gap:12,marginLeft:12}}><div style={{fontSize:14,fontWeight:700,color:C.text}}>{item.sqft.toLocaleString()+" sf"}</div><button onClick={function(){removeM(item.id);}} style={{background:"none",border:"none",color:C.danger,fontSize:11,cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:600}}>{"Remove"}</button></div>
              </div>);})}
            </div>
          </div>)}
        </div>)}
        {p.measurements.length===0&&(<div style={{textAlign:"center",padding:"40px 16px",color:C.dim}}><div style={{fontSize:14}}>{"Start measuring — add locations above"}</div></div>)}
        </div>
      </div>
    </div>{/* end row 2 */}
  </div>);
}

/* ══════════ QUOTE BUILDER ══════════ */

function newOption(name){return{name:name,items:[],pso:false,psoKw:false,extraLabor:false,extraLaborAmt:"",tripCharge:false,tripChargeAmt:"",energySeal:false,energySealAmt:"",dumpster:false,dumpsterAmt:"",customItems:[],overrideTotal:""};}

function PricingImportEditor(p){
  var item=p.item;
  var sp=useState(item.matNote||""),pricingMat=sp[0],setPricingMat=sp[1];
  var pp=useState(""),pricingPrice=pp[0],setPricingPrice=pp[1];
  var PMBTNS=[
    {id:"R11",label:"R11",value:"R11 Fiberglass Batts",sub:null},
    {id:"R13",label:"R13",value:null,sub:[{id:"x15",label:"x15",value:"R13 x15 Fiberglass Batts"},{id:"x24",label:"x24",value:"R13 x24 Fiberglass Batts"}]},
    {id:"R19",label:"R19",value:null,sub:[{id:"x15",label:"x15",value:"R19 x15 Fiberglass Batts"},{id:"x24",label:"x24",value:"R19 x24 Fiberglass Batts"}]},
    {id:"R30",label:"R30",value:null,sub:[{id:"x15",label:"x15",value:"R30 x15 Fiberglass Batts"},{id:"x24",label:"x24",value:"R30 x24 Fiberglass Batts"}]},
    {id:"opencell",label:"Open Cell",value:null,sub:["2\"","3\"","4\"","5\"","6\""].map(function(v){return{id:v,label:v,value:v+' Open Cell Foam'};})},
    {id:"closedcell",label:"Closed Cell",value:null,sub:["1\"","2\"","3\""].map(function(v){return{id:v,label:v,value:v+' Closed Cell Foam'};})},
    {id:"blownfg",label:"Blown Fiberglass",value:null,sub:["R13","R15","R19","R22","R26","R30","R38","R44","R49","R60"].map(function(r){return{id:r,label:r,value:"Blown Fiberglass "+r};})},
    {id:"blowncel",label:"Blown Cellulose",value:null,sub:["R13","R15","R19","R22","R26","R30","R38","R44","R49","R60"].map(function(r){return{id:r,label:r,value:"Blown Cellulose "+r};})},
    {id:"removal",label:"Removal",value:"Removal",sub:null},
  ];
  var bs=function(active){return{padding:"7px 11px",borderRadius:8,border:active?"2px solid "+C.accent:"1px solid rgba(0,0,0,0.08)",background:active?"rgba(37,99,235,0.1)":"rgba(255,255,255,0.6)",color:active?C.accent:C.text,fontSize:12,fontWeight:active?700:500,cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.12s"};};
  var activePrimary=PMBTNS.find(function(b){return pricingMat&&(b.value===pricingMat||(b.sub&&b.sub.some(function(s){return s.value===pricingMat;})));});
  var activePrimaryId=activePrimary?activePrimary.id:"";
  return(<div style={{marginTop:10,padding:12,background:C.bg,borderRadius:8,border:"1px solid "+C.border}}>
    <div style={{fontSize:11,color:C.accent,fontWeight:600,marginBottom:8}}>{"Adding to: "+p.optionName}</div>
    <div style={{fontSize:10,fontWeight:700,color:C.textSec,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>{"Material"}{!pricingMat&&<span style={{color:C.danger,marginLeft:4}}>{"*"}</span>}</div>
    <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:6}}>
      {PMBTNS.map(function(b){
        var active=activePrimaryId===b.id;
        return(<button key={b.id} onClick={function(){if(b.value){setPricingMat(b.value);}else{setPricingMat("");}}} style={bs(active)}>{b.label}</button>);
      })}
    </div>
    {activePrimary&&activePrimary.sub&&(<div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8,paddingLeft:8,borderLeft:"3px solid "+C.accent}}>
      {activePrimary.sub.map(function(s){return(<button key={s.id} onClick={function(){setPricingMat(s.value);}} style={bs(pricingMat===s.value)}>{s.label}</button>);})}
    </div>)}
    {pricingMat&&<div style={{fontSize:11,color:C.accent,fontWeight:600,marginBottom:8}}>{"✓ "+pricingMat}</div>}
    <div style={{display:"flex",gap:6,alignItems:"center"}}>
      <div style={{flex:1}}><QV_Input label="$/sf" value={pricingPrice} onChange={setPricingPrice} placeholder="0.00" step="0.01"/></div>
      <button onClick={function(){p.onAdd(item,pricingMat,pricingPrice);}} disabled={!pricingMat||!(parseFloat(pricingPrice)>0)} style={{padding:"8px 14px",background:(!pricingMat||!(parseFloat(pricingPrice)>0))?"#cbd5e1":C.accent,border:"none",borderRadius:6,color:"#fff",fontWeight:600,fontSize:12,cursor:(!pricingMat||!(parseFloat(pricingPrice)>0))?"not-allowed":"pointer",fontFamily:"'Inter',sans-serif"}}>{"Add"}</button>
      <button onClick={p.onCancel} style={{padding:"8px 10px",background:"none",border:"1px solid "+C.dim,borderRadius:6,color:C.dim,fontSize:12,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>{"Cancel"}</button>
    </div>
  </div>);
}

function QuoteBuilderSection(p){
  var s1=useState("fiberglass"),matTab=s1[0],setMatTab=s1[1];
  var s2=useState(null),pricingId=s2[0],setPricingId=s2[1];
  var s13=useState(0),activeIdx=s13[0],setActiveIdx=s13[1];
  var s14=useState(false),editingName=s14[0],setEditingName=s14[1];
  var ls=useState(""),lid=ls[0],setLid=ls[1];
  var cs=useState(""),cl=cs[0],setCl=cs[1];

  var opts=p.quoteOpts;var setOpts=p.setQuoteOpts;
  if(activeIdx>=opts.length)setActiveIdx(0);
  var opt=opts[activeIdx]||newOption("Option 1");

  function updateOpt(changes){setOpts(function(prev){return prev.map(function(o,i){return i===activeIdx?Object.assign({},o,changes):o;});});}
  function addItem(item){
    var existing=opt.items.find(function(i){return i.description===item.description;});
    if(existing){
      var newSqft=existing.sqft+item.sqft;
      var newTotal=Math.ceil(newSqft*existing.pricePerUnit);
      updateOpt({items:opt.items.map(function(i){return i.id===existing.id?Object.assign({},i,{sqft:newSqft,total:newTotal}):i;}),overrideTotal:""});
    }else{
      updateOpt({items:opt.items.concat([Object.assign({},item,{id:Date.now()+Math.random()})]),overrideTotal:""});
    }
  }
  function removeItem(id){updateOpt({items:opt.items.filter(function(i){return i.id!==id;}),overrideTotal:""});}

  var unpriced=p.importedItems.filter(function(i){return!i.priced;});
  var lineItemsTotal=getOptionLineItemsTotal(opt);
  var psoCredit=getPsoCredit(opt);
  var extraLabor=opt.extraLabor?(parseFloat(opt.extraLaborAmt)||0):0;
  var tripCharge=opt.tripCharge?(parseFloat(opt.tripChargeAmt)||0):0;
  var energySeal=opt.energySeal?(parseFloat(opt.energySealAmt)||0):0;
  var dumpster=opt.dumpster?(parseFloat(opt.dumpsterAmt)||0):0;
  var customItemsTotal=(opt.customItems||[]).reduce(function(s,ci){return s+(parseFloat(ci.price)||0);},0);
  var subtotal=getCalculatedOptionTotal(opt);
  var finalTotal=getFinalOptionTotal(opt);
  var matSs={width:"100%",padding:"8px 10px",background:C.input,border:"1px solid "+C.inputBorder,borderRadius:6,color:C.text,fontSize:13,fontFamily:"'Inter',sans-serif",outline:"none",boxSizing:"border-box",WebkitAppearance:"none",marginBottom:8};

  function handlePriceImport(item, selectedMat, selectedPrice){var pr=parseFloat(selectedPrice)||0;if(pr<=0||!selectedMat)return;
    var isRem=selectedMat==="Removal";
    var desc=isRem?("Remove existing insulation from "+item.location.toLowerCase()+"."):("Install "+selectedMat.toLowerCase()+" in "+item.location.toLowerCase());
    addItem(Object.assign({},item,{material:selectedMat,pricePerUnit:pr,total:Math.ceil(item.sqft*pr),description:desc}));
    p.setImportedItems(function(prev){return prev.map(function(i){return i.id===item.id?Object.assign({},i,{priced:true}):i;});});
    setPricingId(null);}

  function addOption(){setOpts(function(prev){return prev.concat([newOption("Option "+(prev.length+1))]);});setActiveIdx(opts.length);}
  function removeOption(idx){if(opts.length<=1)return;setOpts(function(prev){return prev.filter(function(_,i){return i!==idx;});});if(activeIdx>=opts.length-1)setActiveIdx(Math.max(0,opts.length-2));}

  var qs1=useState(false),locOpen=qs1[0],setLocOpen=qs1[1];
  var cid1=useState(""),customDesc=cid1[0],setCustomDesc=cid1[1];
  var cid2=useState(""),customPrice=cid2[0],setCustomPrice=cid2[1];
  var accordionBtn=function(label,open,setOpen,badge){return(<button onClick={function(){setOpen(!open);}} style={{width:"100%",padding:"10px 14px",background:"#1e293b",display:"flex",justifyContent:"space-between",alignItems:"center",borderRadius:open?"8px 8px 0 0":"8px",border:"none",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
    <span style={{fontSize:12,fontWeight:800,color:"#fff",textTransform:"uppercase",letterSpacing:0.8}}>{label}</span>
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      {badge&&<span style={{fontSize:13,fontWeight:600,color:"#93c5fd"}}>{badge}</span>}
      <span style={{fontSize:13,color:"rgba(255,255,255,0.6)"}}>{open?"▲":"▼"}</span>
    </div>
  </button>);};

  function persistQuoteSummary() {
    var cust={name:p.custName,address:p.custAddr,phone:p.custPhone,email:p.custEmail,jobAddress:p.jobAddr};
    var summary=buildQuoteSummary({customer:cust,quoteOpts:opts,salesman:p.currentUser,jobName:p.custName||p.jobAddr||p.custAddr||"Quote"});
    saveQuoteSummary(summary).catch(function(e){console.warn("Quote summary save failed",e);});
    return cust;
  }

  return(<div>
    <CustomerInfo custName={p.custName} setCustName={p.setCustName} custAddr={p.custAddr} setCustAddr={p.setCustAddr} custPhone={p.custPhone} setCustPhone={p.setCustPhone} custEmail={p.custEmail} setCustEmail={p.setCustEmail} jobAddr={p.jobAddr} setJobAddr={p.setJobAddr} currentUser={p.currentUser}/>

    {/* ROW 1: Single collapsible — Location + Material & Measure side by side */}
    <div style={{padding:"0 16px 12px"}}>
      <div style={{background:"rgba(255,255,255,0.65)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderRadius:12,border:"1px solid rgba(255,255,255,0.8)",boxShadow:"0 4px 24px rgba(0,0,0,0.07)",overflow:"hidden"}}>
        {accordionBtn("📐 Add Item",locOpen,setLocOpen,lid&&LOCATIONS.find(function(l){return l.id===lid;})?(LOCATIONS.find(function(l){return l.id===lid;}).label):(lid==="custom"?cl:null))}
        {locOpen&&(<div className="ist-2col" style={{marginBottom:0}}>
          <div className="ist-col-form">
            <div style={{padding:"12px 14px"}}>
              <div style={{fontSize:11,fontWeight:700,color:C.accent,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>{"① Location"}</div>
              <LocationGrid value={lid} onChange={function(v){setLid(v);}}/>
              {lid==="custom"&&(<div style={{marginTop:8}}><QV_Input label="Custom Location Name" value={cl} onChange={setCl} type="text" placeholder="e.g. Bonus room walls"/></div>)}
            </div>
          </div>
          <div className="ist-col-results">
            <div style={{padding:"12px 14px"}}>
              <div style={{fontSize:11,fontWeight:700,color:C.accent,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>{"② Material & Measure"}</div>
              <MeasurementForm key={"qb-"+activeIdx} lid={lid} setLid={setLid} cl={cl} setCl={setCl} tab={matTab} onAdd={function(item){addItem(item);setLocOpen(false);}} hasPrice={true} hideLocation/>
            </div>
          </div>
        </div>)}
      </div>
    </div>

    {/* ROW 2: Full-width quote summary */}
    <div style={{padding:"0 16px"}}>

    {/* OPTION TABS */}
    <div style={{marginBottom:12}}>
      <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
        {opts.map(function(o,idx){return(
          <button key={idx} onClick={function(){setActiveIdx(idx);setPricingId(null);}}
            style={{padding:"8px 14px",borderRadius:6,border:activeIdx===idx?"2px solid "+C.accent:"1px solid "+C.border,background:activeIdx===idx?C.accentBg:C.card,color:activeIdx===idx?C.accent:C.dim,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
            {o.name}{o.items.length>0?" ("+o.items.length+")":""}
          </button>
        );})}
        <button onClick={addOption} style={{padding:"8px 12px",borderRadius:6,border:"1px dashed "+C.dim,background:"transparent",color:C.dim,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>{"+"}</button>
        <div style={{display:"flex",alignItems:"center",gap:8,marginLeft:8}}>
          {editingName?(<div style={{display:"flex",gap:6}}>
            <input style={{padding:"6px 10px",background:C.input,border:"1px solid "+C.accent,borderRadius:6,color:C.text,fontSize:13,fontFamily:"'Inter',sans-serif",outline:"none"}}
              type="text" value={opt.name} onChange={function(e){updateOpt({name:e.target.value});}} autoFocus
              onKeyDown={function(e){if(e.key==="Enter")setEditingName(false);}}/>
            <button onClick={function(){setEditingName(false);}} style={{padding:"6px 10px",background:C.accent,border:"none",borderRadius:6,color:"#fff",fontWeight:600,fontSize:12,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>{"OK"}</button>
          </div>):(<div style={{display:"flex",alignItems:"center",gap:8}}>
            <button onClick={function(){setEditingName(true);}} style={{background:"none",border:"none",color:C.dim,fontSize:11,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>{"Rename"}</button>
            {opts.length>1&&(<button onClick={function(){if(confirm("Delete \""+opt.name+"\"?"))removeOption(activeIdx);}} style={{background:"none",border:"none",color:C.danger,fontSize:11,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>{"Delete"}</button>)}
          </div>)}
        </div>
      </div>
    </div>

    {/* FROM TAKE OFF */}
    {unpriced.length>0&&(<div style={{marginBottom:16}}>
      <div style={{fontSize:12,fontWeight:700,color:C.accent,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10}}>{"From Take Off — Price These ("+unpriced.length+")"}</div>
      <div style={{background:C.card,borderRadius:6,border:"1px solid "+C.border,overflow:"hidden"}}>
        {unpriced.map(function(item,idx){return(<div key={item.id} style={{padding:"12px 14px",borderBottom:idx<unpriced.length-1?"1px solid "+C.border:"none"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:C.text}}>{item.isRemoval?(<span><span style={{fontSize:10,fontWeight:700,color:C.danger,background:C.dangerBg,padding:"2px 6px",borderRadius:4,marginRight:6}}>{"REMOVAL"}</span>{item.location}</span>):item.location}</div><div style={{fontSize:12,color:C.dim,marginTop:2}}>{item.sqft.toLocaleString()+" sq ft"}{item.pitch?" · "+item.pitch:""}</div></div>
            <div style={{display:"flex",alignItems:"center",gap:6,marginLeft:12}}>
              {pricingId!==item.id&&(<button onClick={function(){setPricingId(item.id);}} style={{padding:"6px 14px",background:"transparent",border:"1px solid "+C.accent,borderRadius:6,color:C.accent,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif",textTransform:"uppercase"}}>{"Price"}</button>)}
              <button onClick={function(){p.setImportedItems(function(prev){return prev.filter(function(i){return i.id!==item.id;});});}} style={{padding:"4px 6px",background:"none",border:"none",color:C.danger,fontSize:11,cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:600}}>{"Remove"}</button>
            </div>
          </div>
          {pricingId===item.id&&(<PricingImportEditor key={item.id} item={item} optionName={opt.name} onAdd={handlePriceImport} onCancel={function(){setPricingId(null);}}/>)}
        </div>);})}
      </div>

    </div>)}

    {/* ADD MANUALLY */}
    {/* QUOTE TOTAL — pinned card */}
    {opt.items.length>0&&(<div style={{padding:"0 16px 16px"}}>
      <div style={{background:C.accent,borderRadius:10,padding:"18px 22px",display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:"0 4px 16px rgba(37,99,235,0.18)"}}>
        <div>
          <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.75)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>{opt.name+" · "+opt.items.length+" item"+(opt.items.length!==1?"s":"")}</div>
          <div style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.85)"}}>{"Estimated Total"}</div>
        </div>
        <div style={{fontSize:38,fontWeight:900,color:"#fff",letterSpacing:"-0.02em"}}>
          {"$"+(opt.overrideTotal!==""?(parseFloat(opt.overrideTotal)||0).toLocaleString():((opt.items.reduce(function(s,i){return s+i.total;},0)-((opt.pso||false)?600:0)-((opt.psoKw||false)?525:0)+(opt.extraLabor?(parseFloat(opt.extraLaborAmt)||0):0)+(opt.tripCharge?(parseFloat(opt.tripChargeAmt)||0):0)+(opt.energySeal?(parseFloat(opt.energySealAmt)||0):0)+(opt.dumpster?(parseFloat(opt.dumpsterAmt)||0):0))).toLocaleString())}
        </div>
      </div>
    </div>)}
    {/* ITEMS FOR ACTIVE OPTION */}
    {opt.items.length>0&&(<div style={{padding:"0 16px 20px"}}>
      <div style={{fontSize:12,fontWeight:700,color:C.accent,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>{opt.name+" — Items ("+opt.items.length+")"}</div>
      <div style={{background:C.card,borderRadius:6,padding:16,border:"1px solid "+C.border,boxShadow:C.shadow}}>
        {opt.items.map(function(item,idx){return(<div key={item.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:idx<opt.items.length-1?"1px solid "+C.border:"none"}}>
          <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,lineHeight:1.3,color:C.text}}>{item.description}</div><div style={{fontSize:12,color:C.dim,marginTop:2}}>{item.sqft.toLocaleString()+" sq ft"}{item.pitch?" · "+item.pitch:""}</div></div>
          <div style={{marginLeft:12}}><button onClick={function(){removeItem(item.id);}} style={{background:"none",border:"none",color:C.danger,fontSize:11,cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:600}}>{"REMOVE"}</button></div>
        </div>);})}

        {/* ADJUSTMENTS */}
        <div style={{paddingTop:12,marginTop:8,borderTop:"1px solid "+C.borderLight}}>
          <label style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",cursor:"pointer"}}>
            <input type="checkbox" checked={opt.pso} onChange={function(e){updateOpt({pso:e.target.checked,overrideTotal:""});}}
              style={{width:18,height:18,accentColor:C.accent,cursor:"pointer"}}/>
            <span style={{fontSize:13,fontWeight:600,color:C.text}}>{"PSO Credit Attic"}</span>
            {opt.pso&&(<span style={{fontSize:13,fontWeight:700,color:C.danger,marginLeft:"auto"}}>{"-$600"}</span>)}
          </label>
          <label style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",cursor:"pointer"}}>
            <input type="checkbox" checked={opt.psoKw||false} onChange={function(e){updateOpt({psoKw:e.target.checked,overrideTotal:""});}}
              style={{width:18,height:18,accentColor:C.accent,cursor:"pointer"}}/>
            <span style={{fontSize:13,fontWeight:600,color:C.text}}>{"PSO Credit KW"}</span>
            {opt.psoKw&&(<span style={{fontSize:13,fontWeight:700,color:C.danger,marginLeft:"auto"}}>{"-$525"}</span>)}
          </label>
          <label style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",cursor:"pointer"}}>
            <input type="checkbox" checked={opt.extraLabor} onChange={function(e){updateOpt({extraLabor:e.target.checked,overrideTotal:""});}}
              style={{width:18,height:18,accentColor:C.accent,cursor:"pointer"}}/>
            <span style={{fontSize:13,fontWeight:600,color:C.text}}>{"Extra Labor"}</span>
            <span style={{fontSize:10,color:C.dim,fontStyle:"italic"}}>{"(not on quote)"}</span>
            {opt.extraLabor&&(
              <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:4}}>
                <span style={{fontSize:13,color:C.text}}>{"$"}</span>
                <input type="number" value={opt.extraLaborAmt} onChange={function(e){updateOpt({extraLaborAmt:e.target.value,overrideTotal:""});}}
                  style={{width:80,padding:"4px 8px",background:C.bg,border:"1px solid "+C.borderLight,borderRadius:6,color:C.text,fontSize:13,fontWeight:600,fontFamily:"'Inter',sans-serif",outline:"none",textAlign:"right"}} placeholder="0" step="1"/>
              </div>
            )}
          </label>
          <label style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",cursor:"pointer"}}>
            <input type="checkbox" checked={opt.tripCharge} onChange={function(e){updateOpt({tripCharge:e.target.checked,overrideTotal:""});}}
              style={{width:18,height:18,accentColor:C.accent,cursor:"pointer"}}/>
            <span style={{fontSize:13,fontWeight:600,color:C.text}}>{"Trip Charge"}</span>
            <span style={{fontSize:10,color:C.dim,fontStyle:"italic"}}>{"(not on quote)"}</span>
            {opt.tripCharge&&(
              <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:4}}>
                <span style={{fontSize:13,color:C.text}}>{"$"}</span>
                <input type="number" value={opt.tripChargeAmt} onChange={function(e){updateOpt({tripChargeAmt:e.target.value,overrideTotal:""});}}
                  style={{width:80,padding:"4px 8px",background:C.bg,border:"1px solid "+C.borderLight,borderRadius:6,color:C.text,fontSize:13,fontWeight:600,fontFamily:"'Inter',sans-serif",outline:"none",textAlign:"right"}} placeholder="0" step="1"/>
              </div>
            )}
          </label>
          <label style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",cursor:"pointer"}}>
            <input type="checkbox" checked={opt.energySeal||false} onChange={function(e){updateOpt({energySeal:e.target.checked,overrideTotal:""});}}
              style={{width:18,height:18,accentColor:C.accent,cursor:"pointer"}}/>
            <span style={{fontSize:13,fontWeight:600,color:C.text}}>{"Energy Seal & Plates"}</span>
            {opt.energySeal&&(
              <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:4}}>
                <span style={{fontSize:13,color:C.text}}>{"$"}</span>
                <input type="number" value={opt.energySealAmt||""} onChange={function(e){updateOpt({energySealAmt:e.target.value,overrideTotal:""});}}
                  style={{width:80,padding:"4px 8px",background:C.bg,border:"1px solid "+C.borderLight,borderRadius:6,color:C.text,fontSize:13,fontWeight:600,fontFamily:"'Inter',sans-serif",outline:"none",textAlign:"right"}} placeholder="0" step="1"/>
              </div>
            )}
          </label>
          {/* Dumpster — internal only, never on quote */}
          <label style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderTop:"1px solid "+C.borderLight,cursor:"pointer"}}>
            <input type="checkbox" checked={opt.dumpster||false} onChange={function(e){updateOpt({dumpster:e.target.checked});}}
              style={{width:18,height:18,accentColor:C.accent,cursor:"pointer"}}/>
            <span style={{fontSize:13,fontWeight:600,color:C.text}}>{"Dumpster"}</span>
            <span style={{fontSize:11,color:C.dim,marginLeft:2}}>{"(internal only)"}</span>
            {opt.dumpster&&(
              <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:4}}>
                <span style={{fontSize:13,color:C.text}}>{"$"}</span>
                <input type="number" value={opt.dumpsterAmt||""} onChange={function(e){updateOpt({dumpsterAmt:e.target.value});}}
                  style={{width:80,padding:"4px 8px",background:C.bg,border:"1px solid "+C.borderLight,borderRadius:6,color:C.text,fontSize:13,fontWeight:600,fontFamily:"'Inter',sans-serif",outline:"none",textAlign:"right"}} placeholder="0" step="1"/>
              </div>
            )}
          </label>
          {/* Custom Line Items */}
          <div style={{borderTop:"1px solid "+C.borderLight,paddingTop:10,marginTop:2}}>
            <div style={{fontSize:11,fontWeight:700,color:C.accent,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>{"+ Custom Line Items"}</div>
            {(opt.customItems||[]).map(function(ci){return(
              <div key={ci.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,padding:"8px 10px",background:C.accentBg,borderRadius:6,border:"1px solid "+C.borderLight}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,color:C.text,fontWeight:500}}>{ci.description}</div>
                  <div style={{fontSize:12,color:C.accent,fontWeight:700,marginTop:2}}>{"$"+(parseFloat(ci.price)||0).toLocaleString()}</div>
                </div>
                <button onClick={function(){updateOpt({customItems:(opt.customItems||[]).filter(function(x){return x.id!==ci.id;}),overrideTotal:""});}} style={{padding:"4px 10px",borderRadius:6,border:"1px solid "+C.danger,background:"transparent",color:C.danger,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>{"✕"}</button>
              </div>
            );})}
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <input type="text" value={customDesc} onChange={function(e){setCustomDesc(e.target.value);}} placeholder="e.g. Treat top of sheetrock with Sterifab"
                onKeyDown={function(e){if(e.key==="Enter"&&customPrice){var d=customDesc.trim();var pr=parseFloat(customPrice)||0;if(d&&pr>0){updateOpt({customItems:(opt.customItems||[]).concat([{id:Date.now()+Math.random(),description:d,price:pr}]),overrideTotal:""});setCustomDesc("");setCustomPrice("");}}} }
                style={{width:"100%",padding:"8px 10px",background:C.input,border:"1px solid "+C.inputBorder,borderRadius:6,color:C.text,fontSize:13,fontFamily:"'Inter',sans-serif",outline:"none",boxSizing:"border-box"}}/>
              <div style={{display:"flex",gap:6}}>
                <div style={{display:"flex",alignItems:"center",gap:4,flex:1}}>
                  <span style={{fontSize:13,color:C.text,fontWeight:600}}>{"$"}</span>
                  <input type="number" value={customPrice} onChange={function(e){setCustomPrice(e.target.value);}} placeholder="Price"
                    style={{flex:1,padding:"8px 10px",background:C.input,border:"1px solid "+C.inputBorder,borderRadius:6,color:C.text,fontSize:13,fontFamily:"'Inter',sans-serif",outline:"none"}}/>
                </div>
                <button onClick={function(){var d=customDesc.trim();var pr=parseFloat(customPrice)||0;if(!d||pr<=0)return;updateOpt({customItems:(opt.customItems||[]).concat([{id:Date.now()+Math.random(),description:d,price:pr}]),overrideTotal:""});setCustomDesc("");setCustomPrice("");}}
                  style={{padding:"8px 16px",background:C.accent,border:"none",borderRadius:6,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>{"Add"}</button>
              </div>
            </div>
          </div>

          <label style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderTop:"1px solid "+C.borderLight,cursor:"pointer"}}>
            <input type="checkbox" checked={p.showProductInfo||false} onChange={function(e){p.setShowProductInfo(e.target.checked);}} style={{width:18,height:18,accentColor:C.accent,cursor:"pointer"}}/>
            <span style={{fontSize:13,fontWeight:600,color:C.text}}>{"Product Information"}</span>
            <span style={{fontSize:11,color:C.dim,marginLeft:2}}>{"(adds spec sheet to PDF)"}</span>
          </label>
        </div>

        {/* TOTAL */}
        <div style={{paddingTop:12,marginTop:4,borderTop:"1px solid "+C.borderLight}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0 0"}}>
            <span style={{fontSize:18,fontWeight:800,color:C.text}}>{"TOTAL"}</span>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:16,fontWeight:800,color:C.text}}>{"$"}</span>
              <input type="number" value={opt.overrideTotal!==""?opt.overrideTotal:subtotal.toFixed(0)} onChange={function(e){updateOpt({overrideTotal:e.target.value});}}
                style={{width:110,padding:"6px 10px",background:C.bg,border:"1px solid "+C.borderLight,borderRadius:6,color:C.text,fontSize:18,fontWeight:800,fontFamily:"'Inter',sans-serif",outline:"none",textAlign:"right"}} step="1"/>
            </div>
          </div>
          {opt.overrideTotal!==""&&parseFloat(opt.overrideTotal)!==subtotal&&(<div style={{fontSize:11,color:C.dim,textAlign:"right",marginTop:4}}>{"Calculated: $"+subtotal.toFixed(0)}</div>)}
        </div>
      </div>
      <button onClick={function(){if(confirm("Clear items from "+opt.name+"?"))updateOpt({items:[]});}} style={{width:"100%",marginTop:8,padding:"10px",borderRadius:6,border:"1px solid "+C.danger,background:"transparent",color:C.danger,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",textTransform:"uppercase"}}>{"Clear "+opt.name}</button>
    </div>)}

    {/* PRINT/SHARE */}
    {opts.some(function(o){return o.items.length>0;})&&(<div style={{marginBottom:16}}>
      <GreenBtn onClick={function(){var cust=persistQuoteSummary();import("./takeoffPdf.js").then(function(mod){mod.generatePDF(cust,opts,p.currentUser,p.showProductInfo||false);});}}>{"Print Quote"}</GreenBtn>
      <GreenBtn mt={8} onClick={function(){var cust=persistQuoteSummary();import("./takeoffPdf.js").then(function(mod){mod.shareQuote(cust,opts,p.currentUser,p.showProductInfo||false);});}}>{"Share Quote"}</GreenBtn>
      <GreenBtn mt={8} onClick={function(){var cust=persistQuoteSummary();import("./takeoffPdf.js").then(function(mod){mod.printQuoteAndTakeOff(cust,opts,p.currentUser,p.jobNotes,p.measurements,opts,p.showProductInfo||false);});}}>{"Print Quote and Take Off"}</GreenBtn>
    </div>)}

    {opt.items.length===0&&unpriced.length===0&&(<div style={{textAlign:"center",padding:"40px 16px",color:C.dim}}><div style={{fontSize:14}}>{"Use Take Off to measure first, or add items manually"}</div></div>)}
    </div>{/* end bottom section */}
  </div>);
}

/* ══════════ TEAM ══════════ */

var TEAM_MEMBERS = ["Johnny", "Skip", "Jordan"];

/* ══════════ SAVED JOBS PANEL ══════════ */

function SavedJobsPanel(p) {
  var s1 = useState([]), jobs = s1[0], setJobs = s1[1];
  var s2 = useState(false), loading = s2[0], setLoading = s2[1];
  var s3 = useState(""), saveName = s3[0], setSaveName = s3[1];
  var s4 = useState(false), showSave = s4[0], setShowSave = s4[1];
  var s5 = useState(""), status = s5[0], setStatus = s5[1];
  var s6 = useState({}), openSections = s6[0], setOpenSections = s6[1];

  function refreshJobs() {
    setLoading(true);
    loadAllJobs(TEAM_MEMBERS).then(function(data) {
      setJobs(data || []);
      setLoading(false);
    });
  }

  useEffect(function() { refreshJobs(); }, []);

  function handleSave() {
    var name = saveName.trim();
    if (!name) { setStatus("⚠️ Enter a job name first."); return; }
    setStatus("Saving...");
    var jobData = {
      custName: p.custName, custAddr: p.custAddr, custPhone: p.custPhone, custEmail: p.custEmail, jobAddr: p.jobAddr, jobNotes: p.jobNotes,
      measurements: p.measurements, quoteOpts: p.quoteOpts, importedItems: p.importedItems, section: p.section,
    };
    saveJob(p.currentUser, name, jobData).then(function(ok) {
      if (ok && !ok.error) {
        var summary = buildQuoteSummary({
          customer: { name: p.custName, address: p.custAddr, phone: p.custPhone, email: p.custEmail, jobAddress: p.jobAddr },
          quoteOpts: p.quoteOpts,
          salesman: p.currentUser,
          sourceTakeoffJobId: ok.id || null,
          jobName: name,
        });
        saveQuoteSummary(summary).catch(function(e) { console.warn("Quote summary save failed", e); });
        setStatus("✓ Saved: " + name);
        setSaveName("");
        setShowSave(false);
        refreshJobs();
        setTimeout(function() { setStatus(""); }, 3000);
      } else {
        setStatus("❌ Save failed — check your connection and try again.");
        setTimeout(function() { setStatus(""); }, 4000);
      }
    }).catch(function(e) {
      setStatus("❌ Error: " + (e.message || "Unknown error"));
      setTimeout(function() { setStatus(""); }, 4000);
    });
  }

  function handleLoad(job) {
    if (!confirm("Load \"" + job.job_name + "\"? This will replace your current work.")) return;
    var d = job.job_data || {};
    p.setCustName(d.custName || "");
    p.setCustAddr(d.custAddr || "");
    p.setCustPhone(d.custPhone || "");
    p.setCustEmail(d.custEmail || "");
    p.setJobAddr(d.jobAddr || "");
    p.setJobNotes(d.jobNotes || "");
    p.setMeasurements(d.measurements || []);
    if (d.quoteOpts) p.setQuoteOpts(d.quoteOpts);
    else if (d.quoteItems && d.quoteItems.length > 0) p.setQuoteOpts([Object.assign(newOption("Option 1"),{items:d.quoteItems})]);
    else p.setQuoteOpts([newOption("Option 1")]);
    p.setImportedItems(d.importedItems || []);
    setStatus("Loaded: " + job.job_name);
    setTimeout(function() { setStatus(""); }, 2000);
  }

  function handleDelete(job) {
    if (!confirm("Delete \"" + job.job_name + "\"?")) return;
    deleteJob(job.id).then(function() { refreshJobs(); });
  }

  var hasWork = p.measurements.length > 0 || p.quoteOpts.some(function(o){return o.items.length>0;}) || (p.custName && p.custName.trim().length > 0) || (p.importedItems && p.importedItems.length > 0);

  return (
    <div style={{ padding: "0 16px 16px" }}>
      {hasWork && (
        <div style={{ marginBottom: 12 }}>
          {!showSave ? (
            <button onClick={function() { setShowSave(true); setSaveName(p.custName || ""); }}
              style={{ width: "100%", padding: "11px 16px", borderRadius: 6, border: "1px solid " + C.accent, background: "transparent", color: C.accent, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {"Save Current Job"}
            </button>
          ) : (
            <div style={{ background: C.card, borderRadius: 6, padding: 14, border: "1px solid " + C.accent, boxShadow: C.shadowMd }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, textTransform: "uppercase", marginBottom: 8 }}>{"Save Job As"}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input style={{ flex: 1, padding: "8px 12px", background: C.input, border: "1px solid " + C.inputBorder, borderRadius: 6, color: C.text, fontSize: 14, fontFamily: "'Inter', sans-serif", outline: "none", transition: "border-color 0.15s" }}
                  type="text" value={saveName} onChange={function(e) { setSaveName(e.target.value); }} placeholder="Job name (e.g. Smith Residence)" autoFocus
                  onKeyDown={function(e) { if (e.key === "Enter") handleSave(); }}
                  onFocus={function(e){e.target.style.borderColor=C.accent;}} onBlur={function(e){e.target.style.borderColor=C.inputBorder;}}
                />
                <button onClick={handleSave} style={{ padding: "8px 16px", background: C.accent, border: "none", borderRadius: 6, color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>{"Save"}</button>
                <button onClick={function() { setShowSave(false); }} style={{ padding: "8px 12px", background: "none", border: "1px solid " + C.dim, borderRadius: 6, color: C.dim, fontSize: 13, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>{"Cancel"}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {status && (<div style={{ padding: "8px 12px", background: C.accentBg, border: "1px solid " + C.accent, borderRadius: 6, fontSize: 13, color: C.accent, fontWeight: 600, marginBottom: 12, textAlign: "center" }}>{status}</div>)}

      {loading && (<div style={{ fontSize: 12, color: C.dim, textAlign: "center", padding: "16px 0" }}>{"Loading..."}</div>)}

      {!loading && TEAM_MEMBERS.map(function(member) {
        var memberJobs = jobs.filter(function(j) { return j.saved_by === member; });
        var isOpen = openSections[member];
        return (
          <div key={member} style={{ marginBottom: 10 }}>
            <button onClick={function() { setOpenSections(function(prev) { var n = Object.assign({}, prev); n[member] = !n[member]; return n; }); }}
              style={{ width: "100%", padding: "12px 16px", borderRadius: isOpen ? "6px 6px 0 0" : 6, border: "1px solid " + C.border, background: C.card, color: C.text, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: C.shadow }}>
              <span>{member + (memberJobs.length > 0 ? " (" + memberJobs.length + ")" : "")}</span>
              <span style={{ fontSize: 14, color: C.dim }}>{isOpen ? "▲" : "▼"}</span>
            </button>
            {isOpen && (
              <div style={{ background: C.card, borderRadius: "0 0 6px 6px", border: "1px solid " + C.border, borderTop: "none", overflow: "hidden" }}>
                {memberJobs.length === 0 && (
                  <div style={{ padding: "12px 14px", fontSize: 12, color: C.dim, textAlign: "center" }}>{"No saved jobs"}</div>
                )}
                {memberJobs.map(function(job, idx) {
                  var date = new Date(job.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  var d = job.job_data || {};
                  var measCount = (d.measurements || []).length;
                  var quoteCount = d.quoteOpts ? d.quoteOpts.reduce(function(s,o){return s+(o.items?o.items.length:0);},0) : (d.quoteItems||[]).length;
                  var info = [];
                  if (measCount > 0) info.push(measCount + " measurements");
                  if (quoteCount > 0) info.push(quoteCount + " quote items");
                  return (
                    <div key={job.id} style={{ padding: "12px 14px", borderBottom: idx < memberJobs.length - 1 ? "1px solid " + C.borderLight : "none" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{job.job_name}</div>
                          <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>
                            {date + (info.length > 0 ? " · " + info.join(", ") : "")}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={function() { handleLoad(job); }}
                            style={{ padding: "6px 12px", background: C.accent, border: "none", borderRadius: 6, color: "#fff", fontWeight: 600, fontSize: 11, cursor: "pointer", fontFamily: "'Inter', sans-serif", textTransform: "uppercase" }}>{"Load"}</button>
                          <button onClick={function() { handleDelete(job); }}
                            style={{ padding: "6px 8px", background: "none", border: "1px solid " + C.danger, borderRadius: 6, color: C.danger, fontSize: 11, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>{"Delete"}</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ══════════ LOGIN SCREEN ══════════ */

function PasscodeInput(p) {
  var s1 = useState(["","","",""]), digits = s1[0], setDigits = s1[1];
  function handleChange(idx, val) {
    if (val && !/^\d$/.test(val)) return;
    var next = digits.slice();
    next[idx] = val;
    setDigits(next);
    if (val && idx < 3) {
      var el = document.getElementById("pin-" + p.id + "-" + (idx + 1));
      if (el) el.focus();
    }
    if (val && idx === 3) {
      var code = next.join("");
      if (code.length === 4) setTimeout(function() { p.onSubmit(code); }, 100);
    }
  }
  function handleKeyDown(idx, e) {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      var el = document.getElementById("pin-" + p.id + "-" + (idx - 1));
      if (el) el.focus();
    }
  }
  var boxStyle = { width: 48, height: 56, textAlign: "center", fontSize: 22, fontWeight: 700, fontFamily: "'Inter',sans-serif", border: "1px solid " + C.border, borderRadius: 6, outline: "none", background: C.card, color: C.text, transition: "border-color 0.15s", boxShadow: C.shadow };
  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
      {[0,1,2,3].map(function(idx) {
        return (<input key={idx} id={"pin-" + p.id + "-" + idx} type="tel" inputMode="numeric" maxLength={1} value={digits[idx]}
          onChange={function(e) { handleChange(idx, e.target.value); }}
          onKeyDown={function(e) { handleKeyDown(idx, e); }}
          onFocus={function(e) { e.target.style.borderColor = C.accent; }}
          onBlur={function(e) { e.target.style.borderColor = C.border; }}
          style={boxStyle} autoFocus={idx === 0}/>);
      })}
    </div>
  );
}

function LoginScreen(p) {
  var s1 = useState(""), selectedUser = s1[0], setSelectedUser = s1[1];
  var s2 = useState("pick"), step = s2[0], setStep = s2[1];
  var s3 = useState(false), loading = s3[0], setLoading = s3[1];
  var s4 = useState(""), error = s4[0], setError = s4[1];
  var s5 = useState(""), firstCode = s5[0], setFirstCode = s5[1];
  var s6 = useState(0), pinKey = s6[0], setPinKey = s6[1];

  function handlePickUser(name) {
    setSelectedUser(name);
    setLoading(true);
    setError("");
    loadPasscode(name).then(function(code) {
      setLoading(false);
      if (code) {
        setStep("enter");
      } else {
        setStep("create");
      }
    });
  }

  function handleEnter(code) {
    setLoading(true);
    setError("");
    loadPasscode(selectedUser).then(function(stored) {
      setLoading(false);
      if (code === stored) {
        localStorage.setItem("ist-user", selectedUser);
        p.onLogin(selectedUser);
      } else {
        setError("Incorrect passcode");
        setPinKey(function(k) { return k + 1; });
      }
    });
  }

  function handleCreate(code) {
    if (!firstCode) {
      setFirstCode(code);
      setStep("confirm");
      setPinKey(function(k) { return k + 1; });
      return;
    }
    if (code !== firstCode) {
      setError("Passcodes don't match. Try again.");
      setFirstCode("");
      setStep("create");
      setPinKey(function(k) { return k + 1; });
      return;
    }
    setLoading(true);
    setError("");
    savePasscode(selectedUser, code).then(function() {
      setLoading(false);
      localStorage.setItem("ist-user", selectedUser);
      p.onLogin(selectedUser);
    });
  }

  function handleBack() {
    setSelectedUser("");
    setStep("pick");
    setError("");
    setFirstCode("");
    setPinKey(function(k) { return k + 1; });
  }

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", position: "fixed", inset: 0, overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        @keyframes kenburns { 0%{transform:scale(1.0) translate(0%,0%)} 50%{transform:scale(1.12) translate(-2%,-1%)} 100%{transform:scale(1.0) translate(0%,0%)} }
        @keyframes authFadeIn { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .kb-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;animation:kenburns 20s ease-in-out infinite;transform-origin:center center}
        .kb-overlay{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,0.55) 0%,rgba(0,0,0,0.35) 50%,rgba(0,0,0,0.65) 100%)}
        .kb-content{animation:authFadeIn 0.45s cubic-bezier(0.16,1,0.3,1) both;position:relative;z-index:1;width:100%;max-width:340px;padding:20px}
        .kb-btn{background:rgba(255,255,255,0.1)!important;backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.2)!important;color:#fff!important;box-shadow:0 4px 24px rgba(0,0,0,0.3)!important;transition:background 0.2s,transform 0.2s!important}
        .kb-btn:hover{background:rgba(255,255,255,0.18)!important;transform:translateY(-2px)}
      `}</style>
      <img className="kb-img" src="/tulsa.jpg" alt="" />
      <div className="kb-overlay" />
      <div className="kb-content">
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.65)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 6 }}>{"Insulation Services of Tulsa"}</div>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: "0.04em", textTransform: "uppercase", margin: 0 }}>{"IST Takeoff"}</h1>
        <div style={{ width: 36, height: 2, background: C.accent, margin: "10px auto 0", borderRadius: 1 }} />
      </div>
      <div style={{ width: "100%" }}>

        {step === "pick" && (<div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, textAlign: "center" }}>{"Who's working?"}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {TEAM_MEMBERS.map(function(name) {
              return (
                <button key={name} onClick={function() { handlePickUser(name); }} className="kb-btn"
                  style={{ width: "100%", padding: "16px 20px", borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", textAlign: "center", border: "none" }}>
                  {name}
                </button>
              );
            })}
          </div>
        </div>)}

        {step === "enter" && (<div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 6 }}>{selectedUser}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 20 }}>{"Enter your passcode"}</div>
          {loading ? (<div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>{"Verifying..."}</div>) : (<PasscodeInput key={pinKey} id="enter" onSubmit={handleEnter}/>)}
          {error && (<div style={{ marginTop: 12, fontSize: 13, color: C.danger, fontWeight: 600 }}>{error}</div>)}
          <button onClick={handleBack} style={{ marginTop: 20, background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer", fontFamily: "'Inter',sans-serif", fontWeight: 600 }}>{"Back"}</button>
        </div>)}

        {step === "create" && (<div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 6 }}>{selectedUser}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 20 }}>{"Create a 4-digit passcode"}</div>
          {loading ? (<div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>{"Loading..."}</div>) : (<PasscodeInput key={pinKey} id="create" onSubmit={handleCreate}/>)}
          {error && (<div style={{ marginTop: 12, fontSize: 13, color: C.danger, fontWeight: 600 }}>{error}</div>)}
          <button onClick={handleBack} style={{ marginTop: 20, background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer", fontFamily: "'Inter',sans-serif", fontWeight: 600 }}>{"Back"}</button>
        </div>)}

        {step === "confirm" && (<div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 6 }}>{selectedUser}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 20 }}>{"Confirm your passcode"}</div>
          {loading ? (<div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>{"Saving..."}</div>) : (<PasscodeInput key={pinKey} id="confirm" onSubmit={handleCreate}/>)}
          {error && (<div style={{ marginTop: 12, fontSize: 13, color: C.danger, fontWeight: 600 }}>{error}</div>)}
          <button onClick={handleBack} style={{ marginTop: 20, background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer", fontFamily: "'Inter',sans-serif", fontWeight: 600 }}>{"Back"}</button>
        </div>)}

      </div>
      </div>
    </div>
  );
}

/* ══════════ WORK ORDER ══════════ */
function WorkOrderSection({measurements, quoteOpts, custName, custAddr, currentUser}) {
  var today = new Date().toISOString().slice(0,10);

  // WO number
  var initWoNum = (function() {
    try { var n = parseInt(localStorage.getItem("ist-wo-counter") || "0"); return n > 0 ? n : 1; } catch(e) { return 1; }
  })();

  var [woNum, setWoNum] = React.useState(String(initWoNum));
  var [dateReady, setDateReady] = React.useState(today);
  var [dateFinished, setDateFinished] = React.useState("");
  var [doorCode, setDoorCode] = React.useState("");
  var [builder, setBuilder] = React.useState(custName || "");
  var [address, setAddress] = React.useState(custAddr || "");
  var [addition, setAddition] = React.useState("");
  var [salesman, setSalesman] = React.useState(currentUser || "");
  var [notes, setNotes] = React.useState("");

  // Sync builder/address/salesman if props change
  React.useEffect(function() { setBuilder(custName || ""); }, [custName]);
  React.useEffect(function() { setAddress(custAddr || ""); }, [custAddr]);
  React.useEffect(function() { setSalesman(currentUser || ""); }, [currentUser]);

  // Mat type mapping
  function matTypeLabel(m) {
    var id = m.locationId || "";
    var map = {
      "band_joist":       "BJ",
      "ext_kneewall":     "BOXED KW",
      "ext_slopes":       "BOXED SLOPES",
      "ext_walls_garage": "GARAGE EXTERIOR",
      "ext_walls_house":  "HOUSE EXTERIOR",
      "flat_ceiling":     "FLAT CEILING",
      "gable_end":        "GABLE",
      "garage_common":    "COMMON WALL",
      "attic_area_garage":"GARAGE ATTIC",
      "attic_area_house": "HOUSE ATTIC",
      "attic_kneewall":   "ATTIC KW",
      "attic_slopes":     "OPEN SLOPES",
      "open_attic_walls": "OPEN ATTIC WALLS",
      "porch":            "PORCH",
      "porch_blocking":   "PORCH BLOCK",
      "roofline":         "RL",
      "roofline_garage":  "GARAGE RL",
      "roofline_house":   "HOUSE RL",
      "custom":           m.customLocation || m.location || "CUSTOM",
    };
    return map[id] || (m.location || m.locationId || "OTHER").toUpperCase();
  }

  // Build initial mat rows from measurements
  var wallIds = ["ext_walls_house","ext_walls_garage","garage_common","ext_kneewall","open_attic_walls","attic_kneewall"];

  // Build a map of locationId → R-value (or inches for foam) from quote items
  function buildRValueMap() {
    var map = {};
    var allItems = (quoteOpts || []).flatMap(function(o) { return o.items || []; });
    allItems.forEach(function(item) {
      if (!item.locationId || map[item.locationId]) return;
      var mat = item.material || item.description || "";
      // Foam: extract inches e.g. '3" Open Cell Foam' → '3"'
      var foamMatch = mat.match(/^(\d+\.?\d*)"?\s*(Open Cell|Closed Cell)/i);
      if (foamMatch) {
        map[item.locationId] = foamMatch[1] + '"';
        return;
      }
      // Fiberglass: extract R-value e.g. "R-13"
      var rMatch = mat.match(/R-?(\d+)/i);
      if (rMatch) map[item.locationId] = "R-" + rMatch[1];
    });
    return map;
  }

  function shortRValue(mat) {
    if (!mat) return "";
    // "R13 x15 Fiberglass Batts" → "13x15"
    var batt = mat.match(/R(\d+)\s*x(\d+)/i);
    if (batt) return batt[1]+"x"+batt[2];
    // "R11 Fiberglass Batts" → "11"
    var simple = mat.match(/^R(\d+)\s+Fiberglass/i);
    if (simple) return simple[1];
    // '4" Open Cell Foam' → '4" OC'
    var oc = mat.match(/^([\d.]+)"\s*Open Cell/i);
    if (oc) return oc[1]+'" OC';
    // '3" Closed Cell Foam' → '3" CC'
    var cc = mat.match(/^([\d.]+)"\s*Closed Cell/i);
    if (cc) return cc[1]+'" CC';
    // bare "Open Cell Foam" / "Closed Cell Foam"
    if (/open cell/i.test(mat)) return "Open Cell";
    if (/closed cell/i.test(mat)) return "Closed Cell";
    // "Blown Fiberglass R30" → "BF R30"
    var bfg = mat.match(/Blown Fiberglass\s*R?(\d+)/i);
    if (bfg) return "BF R"+bfg[1];
    // "Blown Cellulose R30" → "BC R30"
    var bcel = mat.match(/Blown Cellulose\s*R?(\d+)/i);
    if (bcel) return "BC R"+bcel[1];
    return mat;
  }

  function buildMatRows(meas) {
    var rMap = buildRValueMap();
    var rows = (meas || []).map(function(m, i) {
      var isWall = wallIds.includes(m.locationId || "");
      var ht = "";
      if (isWall && m.wallHeightLabel) {
        var match = m.wallHeightLabel.match(/(\d+)['']/);
        ht = match ? match[1] : m.wallHeightLabel.match(/(\d+)/)?.[1] || "";
      }
      var rawMat = (m.matNote && m.matNote.trim()) ? m.matNote.trim() : (rMap[m.locationId] || m.rValue || "");
      var rValue = shortRValue(rawMat) || rawMat;
      return {
        id: "mr-" + i,
        locationId: m.locationId || "",
        matType: matTypeLabel(m),
        wallHeight: ht,
        rValue: rValue,
        width: m.width || "",
        sqft: m.sqft ? String(Math.round(m.sqft)) : "",
        matOut: "",
        matIn: "",
        count: "",
      };
    });
    var atticList=["attic_area_garage","attic_area_house"];
    function getR(s){var m=String(s||"").match(/(\d+)/);return m?parseInt(m[1],10):0;}
    function getR2(s){var m=String(s||"").match(/\d+x(\d+)/);return m?parseInt(m[1],10):0;}
    var sorted=rows.slice().sort(function(a,b){
      var aAttic=atticList.includes(a.locationId||"");
      var bAttic=atticList.includes(b.locationId||"");
      if(aAttic!==bAttic) return aAttic?1:-1;
      var aR=getR(a.rValue),bR=getR(b.rValue);
      if(aR!==bR) return aR-bR;
      return getR2(a.rValue)-getR2(b.rValue);
    });
    return sorted;
  }

  var [matRows, setMatRows] = React.useState(function() { return buildMatRows(measurements); });

  React.useEffect(function() {
    setMatRows(buildMatRows(measurements));
  }, [measurements]);

  // Employees
  var emptyEmp = function() { return {name:"",sqft:"",labor:""}; };
  var [employees, setEmployees] = React.useState([emptyEmp(),emptyEmp(),emptyEmp(),emptyEmp(),emptyEmp()]);

  // R-value summary costs
  // Derive R-value categories from matNote on measurements
  var rCats = (function() {
    var seen = {}, order = [];
    (measurements || []).forEach(function(m) {
      var mat = (m.matNote || "").trim();
      if (!mat) return;
      var label = shortRValue(mat) || mat;
      if (!seen[label]) { seen[label] = true; order.push(label); }
    });
    if (order.length === 0) return ["R-11","R-13","R-19","R-30","BW","E/S"];
    return order.slice().sort(function(a,b){
      var aR=parseInt((a).match(/(\d+)/)||[0,0])||0;
      var bR=parseInt((b).match(/(\d+)/)||[0,0])||0;
      return aR-bR;
    });
  })();

  var [rCosts, setRCosts] = React.useState({});

  // Sum sqft per matNote from measurements
  function getRFootage(cat) {
    return (measurements || []).reduce(function(sum, m) {
      var label = shortRValue((m.matNote||"").trim()) || (m.matNote||"").trim();
      if (label === cat) return sum + (parseFloat(m.sqft) || 0);
      return sum;
    }, 0);
  }

  var atticIds=["attic_area_garage","attic_area_house"];
  function sortedMatRows(rows){
    return rows.slice().sort(function(a,b){
      var aAttic=atticIds.includes(a.locationId||"");
      var bAttic=atticIds.includes(b.locationId||"");
      if(aAttic!==bAttic) return aAttic?1:-1;
      // Extract first number from short value e.g. "13x15" → 13, "Open Cell" → 0
      var aR=parseInt((a.rValue||"").match(/(\d+)/)||[0,0])||0;
      var bR=parseInt((b.rValue||"").match(/(\d+)/)||[0,0])||0;
      if(aR!==bR) return aR-bR;
      // Secondary sort by second number e.g. 13x15 vs 13x24
      var aR2=parseInt(((a.rValue||"").match(/\d+x(\d+)/)||[0,0])[1])||0;
      var bR2=parseInt(((b.rValue||"").match(/\d+x(\d+)/)||[0,0])[1])||0;
      return aR2-bR2;
    });
  }

  function totalLabor() {
    return employees.reduce(function(s,e){ return s+(parseFloat(e.labor)||0); }, 0);
  }

  function updateMatRow(id, field, val) {
    setMatRows(function(rows) { return rows.map(function(r){ return r.id===id ? Object.assign({},r,{[field]:val}) : r; }); });
  }
  function addMatRow() {
    setMatRows(function(rows) { return rows.concat([{id:"mr-new-"+Date.now(),matType:"",rValue:"",width:"",sqft:"",matOut:"",matIn:"",count:""}]); });
  }
  function deleteMatRow(id) {
    setMatRows(function(rows) { return rows.filter(function(r){ return r.id!==id; }); });
  }
  function updateEmp(i, field, val) {
    setEmployees(function(emps) { return emps.map(function(e,idx){ return idx===i ? Object.assign({},e,{[field]:val}) : e; }); });
  }

  var iStyle = {fontFamily:"'Inter',sans-serif",fontSize:12,padding:"4px 6px",border:"1px solid "+C.inputBorder,borderRadius:4,background:C.input,color:C.text,width:"100%",boxSizing:"border-box"};
  var thStyle = {padding:"6px 8px",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em",color:C.textSec,textAlign:"left",borderBottom:"2px solid "+C.border,whiteSpace:"nowrap"};
  var tdStyle = {padding:"4px 6px",fontSize:12,verticalAlign:"middle"};

  function handlePrint() {
    var rSummaryRows = rCats.map(function(cat) {
      var ft = getRFootage(cat);
      return '<tr><td style="padding:4px 8px;border:1px solid #ccc;font-size:12px;">'+cat+'</td><td style="padding:4px 8px;border:1px solid #ccc;font-size:12px;text-align:right;">'+(ft?ft.toLocaleString():"")+'</td><td style="padding:4px 8px;border:1px solid #ccc;font-size:12px;text-align:right;">'+(rCosts[cat]?"$"+rCosts[cat]:"")+'</td></tr>';
    }).join("");

    var matRowsHtml = sortedMatRows(matRows).map(function(r) {
      return '<tr><td style="padding:4px 8px;border:1px solid #ccc;font-size:12px;">'+r.matType+'</td><td style="padding:4px 8px;border:1px solid #ccc;font-size:12px;">'+r.rValue+'</td><td style="padding:4px 8px;border:1px solid #ccc;font-size:12px;color:'+(r.wallHeight?"#2563eb":"#999")+';">'+(r.wallHeight||r.width||"—")+'</td><td style="padding:4px 8px;border:1px solid #ccc;font-size:12px;text-align:right;">'+r.sqft+'</td><td style="padding:4px 8px;border:1px solid #ccc;font-size:12px;text-align:right;">'+r.matOut+'</td><td style="padding:4px 8px;border:1px solid #ccc;font-size:12px;text-align:right;">'+r.matIn+'</td><td style="padding:4px 8px;border:1px solid #ccc;font-size:12px;text-align:right;">'+r.count+'</td></tr>';
    }).join("");

    var empRowsHtml = employees.map(function(e) {
      return '<tr><td style="padding:4px 8px;border:1px solid #ccc;font-size:12px;">'+e.name+'</td><td style="padding:4px 8px;border:1px solid #ccc;font-size:12px;text-align:right;">'+e.sqft+'</td><td style="padding:4px 8px;border:1px solid #ccc;font-size:12px;text-align:right;">'+(e.labor?"$"+e.labor:"")+'</td></tr>';
    }).join("");

    var TH = 'padding:4px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#dbeafe;text-align:left;background:#0f1e46;border:none;';
    var TD = 'padding:3px 8px;font-size:11px;border-bottom:1px solid #e2e8f0;color:#0f172a;vertical-align:middle;';
    var TD2 = 'padding:3px 8px;font-size:11px;border-bottom:1px solid #e2e8f0;color:#0f172a;text-align:right;vertical-align:middle;';
    var matRowsHtmlThemed = sortedMatRows(matRows).map(function(r,i){
      var bg = i%2===0?'#f8fafc':'#fff';
      return '<tr style="background:'+bg+'"><td style="'+TD+'">'+r.matType+'</td><td style="'+TD+'">'+r.rValue+'</td><td style="'+TD+';color:'+(r.wallHeight?'#2563eb':'#94a3b8')+';">'+(r.wallHeight||r.width||'—')+'</td><td style="'+TD2+'">'+r.sqft+'</td><td style="'+TD2+'">'+r.matOut+'</td><td style="'+TD2+'">'+r.matIn+'</td><td style="'+TD2+'">'+r.count+'</td></tr>';
    }).join('');
    var empRowsHtmlThemed = employees.map(function(e,i){
      var bg = i%2===0?'#f8fafc':'#fff';
      return '<tr style="background:'+bg+'"><td style="'+TD+'">'+e.name+'</td><td style="'+TD2+'">'+e.sqft+'</td><td style="'+TD2+'">'+(e.labor?'$'+e.labor:'')+'</td></tr>';
    }).join('');
    var rSummaryRowsThemed = rCats.map(function(cat,i){
      var bg = i%2===0?'#f8fafc':'#fff';
      return '<tr style="background:'+bg+'"><td style="'+TD+'">'+cat+'</td><td style="'+TD2+'"></td><td style="'+TD2+'"></td></tr>';
    }).join('');

    var html = '<!DOCTYPE html><html><head><title>Work Order #'+woNum+'</title>'
      +'<style>'
      +'*{box-sizing:border-box;margin:0;padding:0;}'
      +'body{font-family:\'Helvetica Neue\',Helvetica,Arial,sans-serif;background:#fff;color:#0f172a;}'
      +'table{border-collapse:collapse;width:100%;}'
      +'@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}button{display:none !important;}@page{size:letter;margin:0.35in;}}'
      +'</style></head><body>'

      // ── HEADER BAND ──
      +'<div style="background:#0f1e46;padding:10px 20px 8px;position:relative;">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;">'
      +'<div>'
      +'<div style="font-size:18px;font-weight:900;color:#fff;letter-spacing:0.04em;text-transform:uppercase;">Insulation Services of Tulsa</div>'
      +'<div style="font-size:9px;color:#b4c8f0;margin-top:3px;letter-spacing:0.06em;">Serving Northeastern Oklahoma  •  1 (918) 232-9055</div>'
      +'</div>'
      +'<div style="text-align:right;">'
      +'<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#dbeafe;">Work Order</div>'
      +'<div style="font-size:26px;font-weight:900;color:#fff;line-height:1.1;">#'+woNum+'</div>'
      +'</div>'
      +'</div>'
      +'</div>'
      // Blue accent stripe
      +'<div style="height:4px;background:#2563eb;"></div>'

      // ── JOB INFO CARDS ──
      +'<div style="display:flex;gap:8px;padding:6px 20px 0;">'

      // Card: Job Details
      +'<div style="flex:2;background:#f8fafc;border-radius:6px;padding:6px 12px;border-left:4px solid #2563eb;">'
      +'<div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;margin-bottom:4px;">Job Details</div>'
      +'<table style="width:100%;border:none;"><tr>'
      +'<td style="font-size:10px;font-weight:700;color:#64748b;white-space:nowrap;padding:1px 8px 1px 0;">Date Ready</td>'
      +'<td style="font-size:11px;color:#0f172a;padding:1px 12px 1px 0;">'+dateReady+'</td>'
      +'<td style="font-size:10px;font-weight:700;color:#64748b;white-space:nowrap;padding:1px 8px 1px 0;">Date Finished</td>'
      +'<td style="font-size:11px;color:#0f172a;padding:1px 0;">'+dateFinished+'</td>'
      +'</tr><tr>'
      +'<td style="font-size:10px;font-weight:700;color:#64748b;padding:1px 8px 1px 0;">Builder</td>'
      +'<td style="font-size:11px;color:#0f172a;padding:1px 12px 1px 0;">'+builder+'</td>'
      +'<td style="font-size:10px;font-weight:700;color:#64748b;padding:1px 8px 1px 0;">Addition</td>'
      +'<td style="font-size:11px;color:#0f172a;padding:1px 0;">'+addition+'</td>'
      +'</tr><tr>'
      +'<td style="font-size:10px;font-weight:700;color:#64748b;padding:1px 8px 1px 0;">Address</td>'
      +'<td style="font-size:11px;color:#0f172a;padding:1px 0;" colspan="3">'+address+'</td>'
      +'</tr></table>'
      +'</div>'

      // Card: Assignment
      +'<div style="flex:1;background:#f8fafc;border-radius:6px;padding:6px 12px;border-left:4px solid #2563eb;">'
      +'<div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;margin-bottom:4px;">Assignment</div>'
      +'<table style="width:100%;border:none;"><tr>'
      +'<td style="font-size:10px;font-weight:700;color:#64748b;padding:1px 8px 1px 0;">Salesman</td>'
      +'<td style="font-size:11px;color:#0f172a;">'+salesman+'</td>'
      +'</tr><tr>'
      +'<td style="font-size:10px;font-weight:700;color:#64748b;padding:1px 8px 1px 0;">Door Code</td>'
      +'<td style="font-size:11px;color:#0f172a;">'+doorCode+'</td>'
      +'</tr></table>'
      +'</div>'
      +'</div>'

      // ── MATERIALS TABLE ──
      +'<div style="padding:6px 20px 0;">'
      +'<div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#2563eb;margin-bottom:4px;">Materials</div>'
      +'<table style="border-radius:6px;overflow:hidden;border:1px solid #e2e8f0;">'
      +'<thead><tr>'
      +'<th style="'+TH+'">Mat Type</th>'
      +'<th style="'+TH+'">R-Value</th>'
      +'<th style="'+TH+'">Height</th>'
      +'<th style="'+TH+';text-align:right;">Sq Ft</th>'
      +'<th style="'+TH+';text-align:right;">Mat Out</th>'
      +'<th style="'+TH+';text-align:right;">Mat In</th>'
      +'<th style="'+TH+';text-align:right;">Count</th>'
      +'</tr></thead>'
      +'<tbody>'+matRowsHtmlThemed+'</tbody>'
      +'</table>'
      +'</div>'

      // ── EMPLOYEES + R-VALUE SUMMARY ──
      +'<div style="display:flex;gap:10px;padding:6px 20px 0;">'

      // Employees
      +'<div style="flex:1;">'
      +'<div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#2563eb;margin-bottom:6px;">Employees</div>'
      +'<table style="border-radius:6px;overflow:hidden;border:1px solid #e2e8f0;">'
      +'<thead><tr>'
      +'<th style="'+TH+'">Employee</th>'
      +'<th style="'+TH+';text-align:right;">Sq Ft</th>'
      +'<th style="'+TH+';text-align:right;">Labor ($)</th>'
      +'</tr></thead>'
      +'<tbody>'+empRowsHtmlThemed
      +'<tr style="background:#0f1e46;">'
      +'<td style="padding:6px 10px;font-size:12px;font-weight:700;color:#fff;">TOTAL</td>'
      +'<td style="padding:6px 10px;"></td>'
      +'<td style="padding:6px 10px;font-size:13px;font-weight:900;color:#fff;text-align:right;">$'+totalLabor().toFixed(2)+'</td>'
      +'</tr>'
      +'</tbody></table>'
      +'</div>'

      // R-Value Summary
      +'<div style="flex:1;">'
      +'<div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#2563eb;margin-bottom:6px;">R-Value Summary</div>'
      +'<table style="border-radius:6px;overflow:hidden;border:1px solid #e2e8f0;">'
      +'<thead><tr>'
      +'<th style="'+TH+'">R-Value</th>'
      +'<th style="'+TH+';text-align:right;">Footage</th>'
      +'<th style="'+TH+';text-align:right;">Cost</th>'
      +'</tr></thead>'
      +'<tbody>'+rSummaryRowsThemed+'</tbody>'
      +'</table>'
      +'</div>'
      +'</div>'

      +'<div style="text-align:center;font-size:10px;font-weight:700;color:#64748b;padding:8px 0;letter-spacing:0.06em;text-transform:uppercase;">Work Order Must Be Filled Out Completely</div>'

      +'</body></html>';

    var w = window.open("","_blank");
    w.document.write(html);
    w.document.close();
    w.print();
  }

  var secHead = function(label) {
    return React.createElement("div", {style:{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",color:C.accent,marginBottom:8,marginTop:20,borderBottom:"1px solid "+C.border,paddingBottom:4}}, label);
  };

  var FI = function(props) {
    return React.createElement("div", {style:{flex:1,minWidth:120}},
      React.createElement("label", {style:{fontSize:11,fontWeight:600,color:C.textSec,display:"block",marginBottom:3}}, props.label),
      React.createElement("input", {type:props.type||"text",value:props.value,onChange:function(e){props.onChange(e.target.value);},placeholder:props.placeholder||"",style:Object.assign({},iStyle,{width:"100%"})})
    );
  };

  return React.createElement("div", {style:{maxWidth:900,margin:"0 auto",padding:"16px"}},
    // Title + Print button
    React.createElement("div", {style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}},
      React.createElement("div", {style:{fontSize:16,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.06em",color:C.text}}, "Work Order"),
      React.createElement("button", {onClick:handlePrint,style:{background:C.accent,color:"#fff",border:"none",borderRadius:6,padding:"8px 18px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",letterSpacing:"0.06em",textTransform:"uppercase"}}, "🖨 Print / PDF")
    ),

    // Header fields
    secHead("Job Info"),
    React.createElement("div", {style:{display:"flex",flexWrap:"wrap",gap:10,marginBottom:8}},
      React.createElement(FI, {label:"WO #", value:woNum, onChange:function(v){setWoNum(v);try{localStorage.setItem("ist-wo-counter",v);}catch(e){}}}),
      React.createElement(FI, {label:"Date Ready", type:"date", value:dateReady, onChange:setDateReady}),
      React.createElement(FI, {label:"Date Finished", type:"date", value:dateFinished, onChange:setDateFinished}),
      React.createElement(FI, {label:"Door Code", value:doorCode, onChange:setDoorCode})
    ),
    React.createElement("div", {style:{display:"flex",flexWrap:"wrap",gap:10,marginBottom:8}},
      React.createElement(FI, {label:"Builder", value:builder, onChange:setBuilder}),
      React.createElement(FI, {label:"Address", value:address, onChange:setAddress}),
      React.createElement(FI, {label:"Addition", value:addition, onChange:setAddition}),
      React.createElement(FI, {label:"Salesman", value:salesman, onChange:setSalesman})
    ),

    // Materials table
    secHead("Materials"),
    React.createElement("div", {style:{overflowX:"auto"}},
      React.createElement("table", {style:{width:"100%",borderCollapse:"collapse",fontSize:12}},
        React.createElement("thead", null,
          React.createElement("tr", null,
            ["MAT TYPE","R-VALUE","HEIGHT","SQ FT","MAT OUT","MAT IN","COUNT",""].map(function(h,i) {
              return React.createElement("th", {key:i,style:thStyle}, h);
            })
          )
        ),
        React.createElement("tbody", null,
          sortedMatRows(matRows).map(function(r) {
            return React.createElement("tr", {key:r.id, style:{borderBottom:"1px solid "+C.borderLight}},
              React.createElement("td", {style:tdStyle}, React.createElement("input", {value:r.matType,onChange:function(e){updateMatRow(r.id,"matType",e.target.value);},style:Object.assign({},iStyle,{width:110})})),
              React.createElement("td", {style:tdStyle}, React.createElement("input", {value:r.rValue,onChange:function(e){updateMatRow(r.id,"rValue",e.target.value);},style:Object.assign({},iStyle,{width:70})})),
              React.createElement("td", {style:tdStyle}, React.createElement("input", {value:r.wallHeight||r.width||"",onChange:function(e){updateMatRow(r.id,"wallHeight",e.target.value);},placeholder:"—",style:Object.assign({},iStyle,{width:80,color:r.wallHeight?"#2563eb":undefined})})),

              React.createElement("td", {style:tdStyle}, React.createElement("input", {value:r.sqft,onChange:function(e){updateMatRow(r.id,"sqft",e.target.value);},style:Object.assign({},iStyle,{width:70})})),
              React.createElement("td", {style:tdStyle}, React.createElement("input", {type:"number",value:r.matOut,onChange:function(e){updateMatRow(r.id,"matOut",e.target.value);},style:Object.assign({},iStyle,{width:70})})),
              React.createElement("td", {style:tdStyle}, React.createElement("input", {type:"number",value:r.matIn,onChange:function(e){updateMatRow(r.id,"matIn",e.target.value);},style:Object.assign({},iStyle,{width:70})})),
              React.createElement("td", {style:tdStyle}, React.createElement("input", {type:"number",value:r.count,onChange:function(e){updateMatRow(r.id,"count",e.target.value);},style:Object.assign({},iStyle,{width:60})})),
              React.createElement("td", {style:tdStyle}, React.createElement("button", {onClick:function(){deleteMatRow(r.id);},style:{background:"none",border:"none",color:C.danger,fontSize:14,cursor:"pointer",fontWeight:700}}, "×"))
            );
          })
        )
      )
    ),
    React.createElement("button", {onClick:addMatRow,style:{marginTop:8,fontSize:11,fontWeight:700,background:"none",border:"1px dashed "+C.border,borderRadius:4,color:C.textSec,padding:"4px 14px",cursor:"pointer",fontFamily:"'Inter',sans-serif",textTransform:"uppercase",letterSpacing:"0.06em"}}, "+ Add Row"),

    secHead("Notes"),
    React.createElement("textarea", {value:notes,onChange:function(e){setNotes(e.target.value);},placeholder:"Job notes...",rows:3,style:{width:"100%",boxSizing:"border-box",padding:"8px",border:"1px solid "+C.inputBorder,borderRadius:6,fontSize:12,fontFamily:"'Inter',sans-serif",color:C.text,resize:"vertical"}}),


    React.createElement("div",{style:{textAlign:"center",fontSize:11,fontWeight:700,letterSpacing:"0.05em",color:C.dim,marginTop:24,paddingTop:12,borderTop:"1px solid "+C.border}},"Work Order Must Be Filled Out Completely")
  );
}

/* ══════════ MAIN APP ══════════ */

function QuoteView({ onBack, adminName }) {
  var currentUser = adminName;
  var s1 = useState("takeoff"), sec = s1[0], setSec = s1[1];
  var s2 = useState([]), meas = s2[0], setMeas = s2[1];
  var s3 = useState([newOption("Option 1")]), qOpts = s3[0], setQOpts = s3[1];
  var s4 = useState([]), ii = s4[0], setIi = s4[1];
  var spi = useState(false), showProductInfo = spi[0], setShowProductInfo = spi[1];
  var s5 = useState(""), cn = s5[0], setCn = s5[1];
  var s6 = useState(""), ca = s6[0], setCa = s6[1];
  var s7 = useState(""), cph = s7[0], setCph = s7[1];
  var s8 = useState(""), ce = s8[0], setCe = s8[1];
  var s9 = useState(""), ja = s9[0], setJa = s9[1];
  var s11 = useState(""), jn = s11[0], setJn = s11[1];
  var s10 = useState(true), initialLoad = s10[0], setInitialLoad = s10[1];

  // Auto-save current session to Supabase
  var autoSave = useCallback(function() {
    if (!currentUser) return;
    var data = { measurements: meas, quoteOpts: qOpts, importedItems: ii, custName: cn, custAddr: ca, custPhone: cph, custEmail: ce, jobAddr: ja, jobNotes: jn, section: sec };
    saveAutosave(currentUser, data);
  }, [meas, qOpts, ii, cn, ca, cph, ce, ja, jn, sec, currentUser]);

  useEffect(function() {
    if (initialLoad || !currentUser) return;
    var timer = setTimeout(autoSave, 2000);
    return function() { clearTimeout(timer); };
  }, [autoSave, initialLoad, currentUser]);

  // Load auto-saved session on login
  useEffect(function() {
    if (!currentUser) return;
    loadAutosave(currentUser).then(function(data) {
      if (data) {
        if (data.measurements) setMeas(data.measurements);
        if (data.quoteOpts) setQOpts(data.quoteOpts);
        else if (data.quoteItems && data.quoteItems.length > 0) setQOpts([Object.assign(newOption("Option 1"),{items:data.quoteItems})]);
        if (data.importedItems) setIi(data.importedItems);
        if (data.custName) setCn(data.custName);
        if (data.custAddr) setCa(data.custAddr);
        if (data.custPhone) setCph(data.custPhone);
        if (data.custEmail) setCe(data.custEmail);
        if (data.jobAddr) setJa(data.jobAddr);
        if (data.jobNotes) setJn(data.jobNotes);
        if (data.section) setSec(data.section);
      }
      setInitialLoad(false);
    });
  }, [currentUser]);

  

  function sendToWorkOrder() { setSec("workorder"); }

  function sendToQuote() {
    if (meas.length === 0) return;
    setIi(function(prev) { return prev.concat(meas.map(function(m) { return Object.assign({}, m, { priced: false }); })); });
    setSec("quote");
  }

  function handleNewJob() {
    var hasWork = meas.length > 0 || qOpts.some(function(o){return o.items.length>0;});
    if (hasWork && !confirm("Start a new job? Make sure you've saved first.")) return;
    setMeas([]); setQOpts([newOption("Option 1")]); setIi([]);
    setCn(""); setCa(""); setCph(""); setCe(""); setJa(""); setJn("");
    setSec("takeoff");
  }

  

  var cp2 = { custName: cn, setCustName: setCn, custAddr: ca, setCustAddr: setCa, custPhone: cph, setCustPhone: setCph, custEmail: ce, setCustEmail: setCe, jobAddr: ja, setJobAddr: setJa, jobNotes: jn, setJobNotes: setJn };

  return (
    <div className="ist-app" style={{ fontFamily: "'Inter', sans-serif", color: C.text, paddingBottom: 32 }}><div style={{ maxWidth: 1140, margin: "0 auto" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        html, body { background: linear-gradient(135deg, #e8eef8 0%, #dde6f5 40%, #cdd9f0 100%); margin: 0; min-height: 100vh; background-attachment: fixed; }
        .ist-app { background: transparent; min-height: 100vh; }
        .ist-app::before { content: ''; position: fixed; inset: 0; background: radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.5) 0%, transparent 70%); pointer-events: none; z-index: 0; }
        .ist-app > * { position: relative; z-index: 1; }
        .ist-2col { display: flex; flex-direction: column; }
        .ist-col-form { min-width: 0; }
        .ist-col-results { min-width: 0; }
        @media (min-width: 768px) {
          .ist-2col { flex-direction: row; align-items: flex-start; gap: 28px; padding: 16px 24px 0; }
          .ist-col-form { flex: 0 0 400px; }
          .ist-col-results { flex: 1 1 0; padding-top: 4px; }
        }
        @media (min-width: 1024px) { .ist-col-form { flex: 0 0 440px; } }
        .ist-clear-btn-inner { max-width: 1140px; margin: 0 auto; }
        input::placeholder, textarea::placeholder { color: rgba(100,116,139,0.5) !important; }
        input, textarea, select { color-scheme: light; }
        * { box-sizing: border-box; }
      `}</style>

      {/* HEADER */}
      <div style={{ background: "rgba(255,255,255,0.55)", backdropFilter: "blur(32px)", WebkitBackdropFilter: "blur(32px)", padding: "18px 20px 0", borderBottom: "none", borderRadius: "0 0 24px 24px", textAlign: "center", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 8px 40px rgba(180,200,240,0.25), inset 0 1px 0 rgba(255,255,255,0.9)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={function(){if(window.confirm("Clear everything?")){setMeas([]);setQOpts([newOption("Option 1")]);setIi([]);setCn("");setCa("");setCph("");setCe("");setJa("");setJn("");setSec("takeoff");}}} style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 6, color: C.danger, fontSize: 10, cursor: "pointer", fontFamily: "'Inter', sans-serif", fontWeight: 700, textTransform: "uppercase", padding: "5px 10px", letterSpacing: "0.04em" }}>{"🗑 Clear"}</button>
            
          </div>
        </div>
        <button onClick={onBack} style={{ position: "absolute", left: 16, top: 16, background: "none", border: "none", color: "#2563eb", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>← Dispatch</button>
        <h1 style={{ fontSize: 17, fontWeight: 800, color: C.text, letterSpacing: "0.05em", margin: 0, textTransform: "uppercase" }}>{"Insulation Services of Tulsa"}</h1>
        <div style={{ fontSize: 10, color: C.dim, marginTop: 3, letterSpacing: "0.14em", textTransform: "uppercase" }}>{COMPANY.tagline}</div>

        <div className="ist-nav-tabs" style={{ display: "flex", gap: 0, overflow: "hidden", borderTop: "1px solid rgba(0,0,0,0.06)", marginTop: 14 }}>
          {[
            { id: "takeoff", label: "TAKE OFF", badge: meas.length || null },
            { id: "quote", label: "QUOTE", badge: qOpts.reduce(function(s,o){return s+o.items.length;},0) || null },
            { id: "workorder", label: "WORK ORDER", badge: null },
            { id: "jobs", label: "JOBS", badge: null },
          ].map(function(t) {
            var active = sec === t.id;
            return (
              <button key={t.id} onClick={function() { setSec(t.id); }}
                style={{ flex: 1, padding: "10px 6px", border: "none", borderRight: "1px solid rgba(0,0,0,0.05)", cursor: "pointer", fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", background: active ? "rgba(255,255,255,0.5)" : "transparent", color: active ? C.accent : C.dim, transition: "all 0.15s ease", boxShadow: active ? "inset 0 -2px 0 "+C.accent : "none" }}>
                {t.label}
                {t.badge ? (<span style={{ display: "inline-block", marginLeft: 5, background: active ? C.accent : "rgba(0,0,0,0.08)", color: active ? "#fff" : C.textSec, fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 6, minWidth: 18, textAlign: "center" }}>{t.badge}</span>) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        {sec === "takeoff" && (<TakeOff measurements={meas} setMeasurements={setMeas} onSendToQuote={sendToQuote} onSendToWorkOrder={sendToWorkOrder} currentUser={currentUser} quoteOpts={qOpts} {...cp2} />)}
        {sec === "quote" && (<QuoteBuilderSection quoteOpts={qOpts} setQuoteOpts={setQOpts} importedItems={ii} setImportedItems={setIi} currentUser={currentUser} measurements={meas} showProductInfo={showProductInfo} setShowProductInfo={setShowProductInfo} {...cp2} />)}
        {sec === "workorder" && (<WorkOrderSection measurements={meas} quoteOpts={qOpts} custName={cn} custAddr={ca} currentUser={currentUser} jobAddr={ja} />)}
        {sec === "jobs" && (
          <div>
            <SavedJobsPanel
              measurements={meas} quoteOpts={qOpts} importedItems={ii}
              setMeasurements={setMeas} setQuoteOpts={setQOpts} setImportedItems={setIi}
              section={sec} setSection={setSec}
              currentUser={currentUser}
              {...cp2}
            />
            <div style={{ padding: "0 16px" }}>
              <button onClick={handleNewJob}
                style={{ width: "100%", padding: "12px 16px", borderRadius: 6, border: "1px solid " + C.borderLight, background: "transparent", color: C.text, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {"+ New Job"}
              </button>
            </div>
          </div>
        )}
      </div>


    </div></div>
  );
}


export default QuoteView;
