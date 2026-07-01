import { COMPANY, GROUP_ORDER, SALESMAN_INFO } from "./constants.js";

export function sharePdfBlob(blob,filename){
  if(navigator.share&&navigator.canShare&&navigator.canShare({files:[new File([blob],filename,{type:"application/pdf"})]})){
    navigator.share({files:[new File([blob],filename,{type:"application/pdf"})],title:filename}).catch(function(err){
      if(err.name!=="AbortError")alert("Share failed: "+err.message);
    });
  }else{
    var url=URL.createObjectURL(blob);
    var a=document.createElement("a");a.href=url;a.download=filename;a.click();
    setTimeout(function(){URL.revokeObjectURL(url);},1000);
  }
}

export function buildQuotePdf(customer,opts,salesman,outputMode,showProductInfo){
  // outputMode: "blob" -> returns Promise<Blob>, "save" -> downloads directly
  return import("jspdf").then(function(mod){
    var jsPDF=mod.jsPDF||mod.default;
    var doc=new jsPDF({unit:"pt",format:"letter"});
    var W=612,M=36,x=M,RW=W-M*2;
    var si=SALESMAN_INFO[salesman];
    var today=new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});
    var qn="IST-"+Date.now().toString(36).toUpperCase();
    var optsWithItems=opts.filter(function(o){return o.items&&o.items.length>0;});
    // Brand colors
    var NAVY=[15,30,70],BLUE=[37,99,235],LIGHTBLUE=[219,234,254],GRAY=[100,116,139],LIGHTGRAY=[248,250,252],WHITE=[255,255,255],BLACK=[15,23,42];

    // ── HEADER BAND ──
    doc.setFillColor(NAVY[0],NAVY[1],NAVY[2]);
    doc.rect(0,0,W,72,"F");
    // Accent stripe
    doc.setFillColor(BLUE[0],BLUE[1],BLUE[2]);
    doc.rect(0,68,W,4,"F");
    // Company name
    doc.setTextColor(WHITE[0],WHITE[1],WHITE[2]);
    doc.setFontSize(20);doc.setFont("helvetica","bold");
    doc.text("INSULATION SERVICES OF TULSA",M,30);
    // Tagline
    doc.setFontSize(9);doc.setFont("helvetica","normal");
    doc.setTextColor(180,200,240);
    doc.text("Serving Northeastern Oklahoma  •  1 (918) 232-9055",M,46);
    // QUOTE label top right
    doc.setTextColor(LIGHTBLUE[0],LIGHTBLUE[1],LIGHTBLUE[2]);
    doc.setFontSize(11);doc.setFont("helvetica","bold");
    doc.text("QUOTE",W-M,24,{align:"right"});
    doc.setFontSize(8);doc.setFont("helvetica","normal");doc.setTextColor(180,200,240);
    doc.text(qn,W-M,36,{align:"right"});
    doc.text(today,W-M,48,{align:"right"});

    var y=90;

    // ── INFO CARDS ──
    var cardH=80;var col=RW/3+4;
    // Card 1: Prepared For
    doc.setFillColor(LIGHTGRAY[0],LIGHTGRAY[1],LIGHTGRAY[2]);
    doc.roundedRect(x,y,col-8,cardH,4,4,"F");
    doc.setFillColor(BLUE[0],BLUE[1],BLUE[2]);doc.rect(x,y,4,cardH,"F");
    doc.setTextColor(GRAY[0],GRAY[1],GRAY[2]);doc.setFontSize(7);doc.setFont("helvetica","bold");
    doc.text("PREPARED FOR",x+12,y+13);
    doc.setTextColor(BLACK[0],BLACK[1],BLACK[2]);doc.setFontSize(11);doc.setFont("helvetica","bold");
    doc.text(customer.name||"—",x+12,y+27,{maxWidth:col-24});
    doc.setFontSize(8);doc.setFont("helvetica","normal");doc.setTextColor(GRAY[0],GRAY[1],GRAY[2]);
    var cy=y+40;
    if(customer.address){var al=doc.splitTextToSize(customer.address,col-24);doc.text(al,x+12,cy);cy+=al.length*11;}
    if(customer.phone){doc.text(customer.phone,x+12,cy);cy+=11;}
    if(customer.email){doc.text(customer.email,x+12,cy);}

    // Card 2: Job Site
    var c2x=x+col;
    doc.setFillColor(LIGHTGRAY[0],LIGHTGRAY[1],LIGHTGRAY[2]);
    doc.roundedRect(c2x,y,col-8,cardH,4,4,"F");
    doc.setFillColor(BLUE[0],BLUE[1],BLUE[2]);doc.rect(c2x,y,4,cardH,"F");
    doc.setTextColor(GRAY[0],GRAY[1],GRAY[2]);doc.setFontSize(7);doc.setFont("helvetica","bold");
    doc.text("JOB SITE",c2x+12,y+13);
    doc.setTextColor(BLACK[0],BLACK[1],BLACK[2]);doc.setFontSize(10);doc.setFont("helvetica","bold");
    var jsAddr=customer.jobAddress||customer.address||"—";
    var jsal=doc.splitTextToSize(jsAddr,col-24);
    doc.text(jsal,c2x+12,y+27);
    doc.setFontSize(8);doc.setFont("helvetica","normal");doc.setTextColor(GRAY[0],GRAY[1],GRAY[2]);
    doc.text("Valid for 30 days from quote date",c2x+12,y+66);

    // Card 3: Sales Rep
    var c3x=x+col*2;
    if(si){
      doc.setFillColor(NAVY[0],NAVY[1],NAVY[2]);
      doc.roundedRect(c3x,y,col-8,cardH,4,4,"F");
      doc.setFillColor(BLUE[0],BLUE[1],BLUE[2]);doc.rect(c3x,y,4,cardH,"F");
      doc.setTextColor(LIGHTBLUE[0],LIGHTBLUE[1],LIGHTBLUE[2]);doc.setFontSize(7);doc.setFont("helvetica","bold");
      doc.text("YOUR SALES REP",c3x+12,y+13);
      doc.setTextColor(WHITE[0],WHITE[1],WHITE[2]);doc.setFontSize(11);doc.setFont("helvetica","bold");
      doc.text(si.fullName,c3x+12,y+27);
      doc.setFontSize(8);doc.setFont("helvetica","normal");doc.setTextColor(180,200,240);
      doc.text(si.phone,c3x+12,y+40);
      doc.text(si.email,c3x+12,y+53);
    }

    y+=cardH+20;

    // ── OPTIONS ──
    optsWithItems.forEach(function(opt,oi){
      var sortedItems=opt.items.slice().sort(function(a,b){
        var aFoam=a.type==="Foam"||/foam/i.test(a.material||"");
        var bFoam=b.type==="Foam"||/foam/i.test(b.material||"");
        if(aFoam&&!bFoam)return -1;if(!aFoam&&bFoam)return 1;
        var aR=parseInt((a.material||"").match(/R(\d+)/i)||[0,0])||0;
        var bR=parseInt((b.material||"").match(/R(\d+)/i)||[0,0])||0;
        return aR-bR;
      });

      if(optsWithItems.length>1){
        if(y>680){doc.addPage();y=40;}
        doc.setFillColor(BLUE[0],BLUE[1],BLUE[2]);doc.rect(x,y,RW,22,"F");
        doc.setTextColor(WHITE[0],WHITE[1],WHITE[2]);doc.setFontSize(11);doc.setFont("helvetica","bold");
        doc.text(opt.name.toUpperCase(),x+10,y+15);
        y+=30;
      }

      // Table header
      doc.setFillColor(NAVY[0],NAVY[1],NAVY[2]);doc.rect(x,y,RW,18,"F");
      doc.setTextColor(LIGHTBLUE[0],LIGHTBLUE[1],LIGHTBLUE[2]);doc.setFontSize(8);doc.setFont("helvetica","bold");
      doc.text("SCOPE OF WORK",x+10,y+12);
      y+=18;

      // Rows
      var allItems=sortedItems.slice();
      if(opt.energySeal)allItems.push({description:"Energy seal and plates per city code."});
      (opt.customItems||[]).forEach(function(ci){allItems.push({description:ci.description,customPrice:parseFloat(ci.price)||0});});
      allItems.forEach(function(item,i){
        if(y>710){doc.addPage();y=40;}
        doc.setFont("helvetica","normal");doc.setFontSize(9.5);
        var desc=doc.splitTextToSize(item.description||"",RW-26);
        var rowH=Math.max(20,desc.length*13+10);
        // Alternating bg
        doc.setFillColor(i%2===0?248:255,i%2===0?250:255,i%2===0?252:255);
        doc.rect(x,y,RW,rowH,"F");
        // Left accent dot centered vertically
        doc.setFillColor(BLUE[0],BLUE[1],BLUE[2]);
        doc.circle(x+7,y+rowH/2,2.5,"F");
        doc.setTextColor(BLACK[0],BLACK[1],BLACK[2]);
        doc.text(desc,x+16,y+13,{lineHeightFactor:1.4});
        // Bottom border
        doc.setDrawColor(226,232,240);doc.setLineWidth(0.4);doc.line(x,y+rowH,x+RW,y+rowH);
        y+=rowH;
      });

      // Total section
      var lineTotal=opt.items.reduce(function(s,i){return s+(i.total||0);},0);
      var psoCredit=((opt.pso||false)?600:0)+((opt.psoKw||false)?525:0);
      var el=opt.extraLabor?(parseFloat(opt.extraLaborAmt)||0):0;
      var tc=opt.tripCharge?(parseFloat(opt.tripChargeAmt)||0):0;
      var es=opt.energySeal?(parseFloat(opt.energySealAmt)||0):0;
      var du=opt.dumpster?(parseFloat(opt.dumpsterAmt)||0):0;
      var ciTotal=(opt.customItems||[]).reduce(function(s,x){return s+(parseFloat(x.price)||0);},0);
      var sub=lineTotal+el+tc+es+du+ciTotal;
      var total=opt.overrideTotal!==""?(parseFloat(opt.overrideTotal)||0):(sub-psoCredit);

      y+=8;
      // PSO credits
      if(opt.pso||opt.psoKw){
        doc.setFontSize(9);doc.setFont("helvetica","normal");
        doc.setTextColor(GRAY[0],GRAY[1],GRAY[2]);
        doc.text("Subtotal",x,y);doc.text("$"+Math.ceil(sub).toLocaleString(),W-M,y,{align:"right"});y+=14;
        if(opt.pso){doc.setTextColor(180,30,30);doc.text("Less PSO Credit — Attic",x,y);doc.text("-$600",W-M,y,{align:"right"});y+=14;}
        if(opt.psoKw){doc.setTextColor(180,30,30);doc.text("Less PSO Credit — Kneewall",x,y);doc.text("-$525",W-M,y,{align:"right"});y+=14;}
        doc.setDrawColor(220,220,230);doc.setLineWidth(0.5);doc.line(x,y,W-M,y);
        y+=8;
      }

      // Total box
      if(y>700){doc.addPage();y=40;}
      doc.setFillColor(BLUE[0],BLUE[1],BLUE[2]);
      doc.roundedRect(W-M-160,y,160,34,4,4,"F");
      doc.setTextColor(WHITE[0],WHITE[1],WHITE[2]);doc.setFontSize(18);doc.setFont("helvetica","bold");
      doc.text("$"+Math.ceil(total).toLocaleString(),W-M-80,y+22,{align:"center"});
      y+=50;
    });

    y+=8;

    // ── PRODUCT INFO (bottom of last page) ──
    if(showProductInfo){
      var colW=(RW-16)/2;
      var leftX=M,rightX=M+colW+16;
      var py=y;

      // ── FIBERGLASS BOX ──
      var FG_TITLE="Johns Manville & CertainTeed";
      var FG_SUB="";
      var FG_INTRO="IST uses a mix of both brands based on availability. They are virtually identical in performance and quality:";
      var FG_BULLETS=["Formaldehyde-free with built-in kraft paper vapor retarder","Available in R-11 through R-49 for walls, floors, and attics","Class A fire rated — won't rot, mildew, or deteriorate","GREENGUARD Gold Certified for indoor air quality","Reduces sound transmission between rooms","Pre-cut batts for standard 16\" and 24\" framing"];
      var FG_FOOTER="Both meet the same ASTM C665 industry standards — no difference in protection regardless of which brand is installed.";

      // ── FOAM BOX ──
      var FM_TITLE="Enverge® Spray Foam Systems";
      var FM_SUB="";
      var FM_BULLETS=["OPEN CELL — EasySeal .5:  R-3.8/in · 0.5 lb/ft³ · air barrier at 3.5\" · UL Certified · ENERGY STAR® qualified","CLOSED CELL — NexSeal:  R-7.2/in (R-28 @ 4\") · 2.1 lb/ft³ · adds structural rigidity · built-in Class II vapor retarder at 1.6\"","Both: Class 1 (Class A) fire rated — Flame Spread <25, Smoke Developed <450","Both: Low VOC — CA Section 01350 compliant · Fungi resistant (ASTM C-1338)","Both: Service temp range: -40°F to 180°F (220°F intermittent)","Closed cell water absorption <0.3% by volume — moisture resistant"];

      function drawProductBox(bx,by,bw,title,sub,intro,bullets,footer){
        var lh=10;var fs=7;
        doc.setFont("helvetica","normal");doc.setFontSize(fs);
        var introLines=intro?doc.splitTextToSize(intro,bw-16).length:0;
        var bulletLines=bullets.reduce(function(n,b){return n+doc.splitTextToSize(b,bw-24).length;},0);
        var footerLines=footer?doc.splitTextToSize(footer,bw-16).length:0;
        var bh=8+10+7+4+(introLines?introLines*lh+5:0)+(bulletLines*lh+bullets.length*2)+(footerLines?footerLines*lh+8:0)+8;
        doc.setFillColor(248,250,255);doc.roundedRect(bx,by,bw,bh,4,4,"F");

        doc.setDrawColor(210,220,240);doc.setLineWidth(0.4);doc.roundedRect(bx,by,bw,bh,4,4,"S");
        var ty=by+9;
        doc.setFont("helvetica","bold");doc.setFontSize(8.5);doc.setTextColor(NAVY[0],NAVY[1],NAVY[2]);
        doc.text(title,bx+9,ty);ty+=10;
        if(sub){doc.setFont("helvetica","bold");doc.setFontSize(fs);doc.setTextColor(BLUE[0],BLUE[1],BLUE[2]);doc.text(sub,bx+9,ty);ty+=7;}
        if(intro){
          doc.setFont("helvetica","italic");doc.setFontSize(fs);doc.setTextColor(GRAY[0],GRAY[1],GRAY[2]);
          var il=doc.splitTextToSize(intro,bw-16);doc.text(il,bx+9,ty);ty+=il.length*lh+5;
        }
        doc.setFont("helvetica","normal");doc.setFontSize(fs);doc.setTextColor(BLACK[0],BLACK[1],BLACK[2]);
        bullets.forEach(function(b){
          var bl=doc.splitTextToSize(b,bw-24);
          doc.setFillColor(BLUE[0],BLUE[1],BLUE[2]);doc.circle(bx+14,ty-2,1.5,"F");
          doc.text(bl,bx+20,ty);ty+=bl.length*lh+2;
        });
        if(footer){
          ty+=3;doc.setDrawColor(210,220,240);doc.setLineWidth(0.3);doc.line(bx+9,ty,bx+bw-9,ty);ty+=6;
          doc.setFont("helvetica","italic");doc.setFontSize(6.5);doc.setTextColor(GRAY[0],GRAY[1],GRAY[2]);
          var fl=doc.splitTextToSize(footer,bw-16);doc.text(fl,bx+9,ty);
        }
        return by+bh;
      }

      // Section label
      doc.setFont("helvetica","bold");doc.setFontSize(8);doc.setTextColor(GRAY[0],GRAY[1],GRAY[2]);
      doc.text("PRODUCT INFORMATION",leftX,py+10);
      doc.setDrawColor(BLUE[0],BLUE[1],BLUE[2]);doc.setLineWidth(0.5);doc.line(leftX,py+13,x+RW,py+13);
      py+=20;
      drawProductBox(leftX,py,colW,FG_TITLE,FG_SUB,FG_INTRO,FG_BULLETS,FG_FOOTER);
      drawProductBox(rightX,py,colW,FM_TITLE,FM_SUB,"",FM_BULLETS,"");
    }

    // ── FOOTER ──
    doc.setFillColor(NAVY[0],NAVY[1],NAVY[2]);
    doc.rect(0,756,W,36,"F");
    doc.setFillColor(BLUE[0],BLUE[1],BLUE[2]);doc.rect(0,756,W,3,"F");
    doc.setTextColor(180,200,240);doc.setFontSize(8);doc.setFont("helvetica","normal");
    doc.text("Insulation Services of Tulsa  •  1 (918) 232-9055  •  Helping Oklahoma stay energy efficient — one home at a time.",W/2,771,{align:"center"});
    doc.setTextColor(100,130,180);doc.setFontSize(7);
    doc.text("Licensed & Insured  •  Proudly serving Tulsa and Northeastern Oklahoma",W/2,782,{align:"center"});

    var filename="Quote"+(customer.jobAddress||customer.address?" - "+(customer.jobAddress||customer.address):"")+".pdf";
    if(outputMode==="save"){doc.save(filename);return null;}
    return doc.output("blob");
  });
}

export function shareQuote(customer,opts,salesman,showProductInfo){
  buildQuotePdf(customer,opts,salesman,"blob",showProductInfo).then(function(blob){
    if(blob){
      var filename="Quote"+(customer.jobAddress||customer.address?" - "+(customer.jobAddress||customer.address):"")+".pdf";
      sharePdfBlob(blob,filename);
    }
  }).catch(function(err){alert("PDF error: "+err.message);});
}

export function buildTakeOffPdf(customer,jobNotes,measurements,salesman,quoteOpts,outputMode){
  return import("jspdf").then(function(mod){
    var jsPDF=mod.jsPDF||mod.default;
    var doc=new jsPDF({unit:"pt",format:"letter"});
    var W=612,M=36,x=M,RW=W-M*2;
    var today=new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});
    var NAVY=[15,30,70],BLUE=[37,99,235],LIGHTBLUE=[219,234,254],GRAY=[100,116,139],WHITE=[255,255,255],BLACK=[15,23,42];

    // ── HEADER ──
    doc.setFillColor(NAVY[0],NAVY[1],NAVY[2]);doc.rect(0,0,W,56,"F");
    doc.setFillColor(BLUE[0],BLUE[1],BLUE[2]);doc.rect(0,52,W,4,"F");
    doc.setTextColor(WHITE[0],WHITE[1],WHITE[2]);doc.setFontSize(16);doc.setFont("helvetica","bold");
    doc.text("INSULATION SERVICES OF TULSA",M,30);
    doc.setFontSize(9);doc.setFont("helvetica","normal");doc.setTextColor(180,200,240);
    doc.text((customer.name||"")+(customer.jobAddress||customer.address?" — "+(customer.jobAddress||customer.address):""),M,46);
    doc.setTextColor(LIGHTBLUE[0],LIGHTBLUE[1],LIGHTBLUE[2]);doc.setFontSize(9);doc.setFont("helvetica","bold");
    doc.text("TAKE OFF  •  "+today,W-M,38,{align:"right"});

    var y=72;

    // ── MEASUREMENTS TABLE ──
    var hasMeasurements=measurements&&measurements.some(function(r){return parseFloat(r.sqft)>0;});
    if(hasMeasurements){
      // Columns: LOCATION | MATERIAL | SQ FT | $/SQ FT
      var c1=x+10,c2=x+180,c3=x+340,c4=x+420;
      doc.setFillColor(NAVY[0],NAVY[1],NAVY[2]);doc.rect(x,y,RW,18,"F");
      doc.setTextColor(LIGHTBLUE[0],LIGHTBLUE[1],LIGHTBLUE[2]);doc.setFontSize(8);doc.setFont("helvetica","bold");
      doc.text("LOCATION",c1,y+12);doc.text("MATERIAL",c2,y+12);doc.text("SQ FT",c3,y+12);doc.text("$/SQ FT",c4,y+12);
      y+=18;
      // Group by location+material+cavityWidth
      var groups2=[];
      measurements.forEach(function(r){
        var sqft=parseFloat(r.sqft)||0;if(!sqft)return;
        var matLabel=(r.matNote&&r.matNote.trim())||r.material||"";
        var key=(r.locationId||r.location)+"|"+matLabel+"|"+(r.cavityWidth||"");
        var g=groups2.find(function(gg){return gg.key===key;});
        if(g){g.entries.push(r);g.totalSqft+=sqft;}
        else groups2.push({key:key,location:(r.location||"")+(r.cavityWidth?" ("+r.cavityWidth+")":""),material:matLabel,pricePerUnit:r.pricePerUnit,entries:[r],totalSqft:sqft});
      });
      // Sort: foam first (no R-number), then by R-value, attics last
      var atticLocIds=["attic_area_garage","attic_area_house"];
      function takeoffR(g){var m=String(g.material||"");var n=m.match(/(\d+)/);return n?parseInt(n[1],10):0;}
      function isFoamG(g){return /foam|open cell|closed cell/i.test(g.material||"");}
      function isAtticG(g){return atticLocIds.some(function(id){return (g.entries[0]&&g.entries[0].locationId===id);});}
      groups2.sort(function(a,b){
        var aAttic=isAtticG(a),bAttic=isAtticG(b);
        if(aAttic!==bAttic) return aAttic?1:-1;
        var aFoam=isFoamG(a),bFoam=isFoamG(b);
        if(aFoam!==bFoam) return aFoam?-1:1;
        return takeoffR(a)-takeoffR(b);
      });

      groups2.forEach(function(g,gi){
        var DIM_H=14;
        // Measure how many lines the location text needs
        doc.setFont("helvetica","bold");doc.setFontSize(9.5);
        var locLines=doc.splitTextToSize(g.location,164).length;
        var ROW_H=Math.max(20,locLines*12+8);
        var groupH=ROW_H+g.entries.length*DIM_H+4;
        if(y+groupH>720){doc.addPage();y=40;}
        doc.setFillColor(gi%2===0?242:250,gi%2===0?246:252,gi%2===0?255:255);
        doc.rect(x,y,RW,groupH,"F");
        doc.setFillColor(BLUE[0],BLUE[1],BLUE[2]);doc.rect(x,y,3,groupH,"F");
        // Header row
        doc.setTextColor(BLACK[0],BLACK[1],BLACK[2]);doc.setFont("helvetica","bold");doc.setFontSize(9.5);
        doc.text(g.location,c1+4,y+13,{maxWidth:164,lineHeightFactor:1.4});
        doc.text(g.material,c2,y+13,{maxWidth:154});
        doc.text(g.totalSqft.toLocaleString(),c3,y+13);
        var ppu=parseFloat(g.pricePerUnit)||0;
        if(ppu)doc.text("$"+ppu.toFixed(2),c4,y+13);
        y+=ROW_H;
        // Individual dim entries
        g.entries.forEach(function(r){
          doc.setFont("helvetica","normal");doc.setFontSize(8.5);doc.setTextColor(GRAY[0],GRAY[1],GRAY[2]);
          var dimLabel=r.dimStr||(r.wallHeightLabel)||"";
          var sqftLabel=(parseFloat(r.sqft)||0).toLocaleString()+" sf";
          doc.text(dimLabel?dimLabel+" = "+sqftLabel:sqftLabel,c1+12,y+10);
          y+=DIM_H;
        });
        doc.setDrawColor(210,220,240);doc.setLineWidth(0.5);doc.line(x,y+2,x+RW,y+2);
        y+=6;
      });
    }

    // ── JOB NOTES ──
    if(jobNotes&&jobNotes.trim()){
      y+=8;
      var noteLines=doc.splitTextToSize(jobNotes.trim(),RW-24);
      var noteBlockH=noteLines.length*13+20;
      if(y+noteBlockH>720){doc.addPage();y=40;}
      doc.setFillColor(249,249,249);doc.rect(x,y,RW,noteBlockH,"F");
      doc.setDrawColor(200,210,230);doc.setLineWidth(0.5);doc.rect(x,y,RW,noteBlockH,"S");
      doc.setFillColor(NAVY[0],NAVY[1],NAVY[2]);doc.rect(x,y,3,noteBlockH,"F");
      doc.setTextColor(GRAY[0],GRAY[1],GRAY[2]);doc.setFontSize(8);doc.setFont("helvetica","bold");
      doc.text("JOB NOTES",x+10,y+12);
      doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(BLACK[0],BLACK[1],BLACK[2]);
      doc.text(noteLines,x+10,y+24);
      y+=noteBlockH+6;
    }

    var filename="TakeOff"+(customer.jobAddress||customer.address?" - "+(customer.jobAddress||customer.address):"")+".pdf";
    if(outputMode==="save"){doc.save(filename);return null;}
    return doc.output("blob");
  });
}

export function shareTakeOff(customer,jobNotes,measurements,salesman,quoteOpts){
  buildTakeOffPdf(customer,jobNotes,measurements,salesman,quoteOpts,"blob").then(function(blob){
    if(blob){
      var filename="TakeOff"+(customer.jobAddress||customer.address?" - "+(customer.jobAddress||customer.address):"")+".pdf";
      sharePdfBlob(blob,filename);
    }
  }).catch(function(err){alert("PDF error: "+err.message);});
}

export function printTakeOff(customer,jobNotes,measurements,salesman,quoteOpts){
  buildTakeOffPdf(customer,jobNotes,measurements,salesman,quoteOpts,"save").catch(function(err){alert("PDF error: "+err.message);});
}

export function buildQuoteHtml(customer,opts,salesman){try{return _buildQuoteHtml(customer,opts,salesman);}catch(e){alert("Quote error: "+e.message);return "";}}
export function _buildQuoteHtml(customer,opts,salesman){
  var today=new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});var qn="IST-"+Date.now().toString(36).toUpperCase();
  var si=SALESMAN_INFO[salesman];
  var salesHtml=si?'<div style="flex:1;text-align:right"><div style="font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px">Your Sales Rep</div><div style="font-size:15px;font-weight:800;color:#111;margin-bottom:3px">'+si.fullName+'</div><div style="font-size:13px;color:#111;font-weight:600;margin-bottom:1px">'+si.phone+'</div><div style="font-size:13px;color:#111;font-weight:600">'+si.email+'</div></div>':'';
  var optsWithItems=opts.filter(function(o){return o.items.length>0;});
  var optSections=optsWithItems.map(function(opt,oi){
    var sortedItems=opt.items.slice().sort(function(a,b){
      var aFoam=a.type==="Foam"||/foam/i.test(a.material||"");
      var bFoam=b.type==="Foam"||/foam/i.test(b.material||"");
      if(aFoam&&!bFoam)return -1;
      if(!aFoam&&bFoam)return 1;
      if(aFoam&&bFoam){
        var aIn=parseFloat((a.material||"").match(/^([\d.]+)/)||[0,0])||0;
        var bIn=parseFloat((b.material||"").match(/^([\d.]+)/)||[0,0])||0;
        return aIn-bIn;
      }
      var aR=parseInt((a.material||"").match(/R(\d+)/i)||[0,0])||0;
      var bR=parseInt((b.material||"").match(/R(\d+)/i)||[0,0])||0;
      return aR-bR;
    });
    var rows=sortedItems.map(function(item,i){return '<tr style="border-bottom:1px solid #ddd"><td style="padding:6px 8px;font-size:13px">'+(i+1)+'</td><td style="padding:6px 8px;font-size:13px">'+item.description+'</td></tr>';}).join("");
    var energySealRow=opt.energySeal?'<tr style="border-bottom:1px solid #ddd"><td style="padding:6px 8px;font-size:13px">'+(opt.items.length+1)+'</td><td style="padding:6px 8px;font-size:13px">Energy seal and plates per city code.</td></tr>':"";
    var customRows=(opt.customItems||[]).map(function(ci,ci_i){return '<tr style="border-bottom:1px solid #ddd"><td style="padding:6px 8px;font-size:13px">'+(opt.items.length+(opt.energySeal?1:0)+ci_i+1)+'</td><td style="padding:6px 8px;font-size:13px">'+ci.description+'</td></tr>';}).join("");
    var lineTotal=opt.items.reduce(function(s,i){return s+i.total;},0);
    var psoCredit=((opt.pso||false)?600:0)+((opt.psoKw||false)?525:0);
    var el=opt.extraLabor?(parseFloat(opt.extraLaborAmt)||0):0;
    var tc=opt.tripCharge?(parseFloat(opt.tripChargeAmt)||0):0;
    var es=opt.energySeal?(parseFloat(opt.energySealAmt)||0):0;
    var du=opt.dumpster?(parseFloat(opt.dumpsterAmt)||0):0;
    var ciTotal=(opt.customItems||[]).reduce(function(s,x){return s+(parseFloat(x.price)||0);},0);
    var sub=lineTotal+el+tc+es+du+ciTotal;
    var total=opt.overrideTotal!==""?(parseFloat(opt.overrideTotal)||0):(sub-psoCredit);
    var header=optsWithItems.length>1?'<div style="font-size:16px;font-weight:800;color:#111;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #111">'+opt.name+'</div>':"";
    var totalLabel=optsWithItems.length>1?opt.name+" Total":"Total";
    var totalHtml="";
    var creditRows="";
    if(opt.psoKw)creditRows+='<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:14px;font-weight:600;color:#dc2626;border-bottom:1px solid #ddd"><span>Less PSO Credit KW</span><span>-$525</span></div>';
    if(opt.pso)creditRows+='<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:14px;font-weight:600;color:#dc2626;border-bottom:1px solid #ddd"><span>Less PSO Credit Attic</span><span>-$600</span></div>';
    if(opt.pso||opt.psoKw){
      totalHtml='<div style="display:flex;justify-content:flex-end;margin-bottom:'+(oi<optsWithItems.length-1?"20":"0")+'px"><div style="width:260px">'+
        '<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:14px;font-weight:600;color:#333"><span>Price</span><span>$'+Math.ceil(sub).toLocaleString()+'</span></div>'+
        creditRows+
        '<div style="display:flex;justify-content:space-between;padding:8px 0;font-size:18px;font-weight:800;color:#111"><span>'+totalLabel+'</span><span>$'+Math.ceil(total).toLocaleString()+'</span></div>'+
        '</div></div>';
    }else{
      totalHtml='<div style="display:flex;justify-content:flex-end;margin-bottom:'+(oi<optsWithItems.length-1?"20":"0")+'px"><div style="width:260px"><div style="display:flex;justify-content:space-between;padding:8px 0;font-size:18px;font-weight:800;color:#111"><span>'+totalLabel+'</span><span>$'+Math.ceil(total).toLocaleString()+'</span></div></div></div>';
    }
    return header+'<table style="width:100%;border-collapse:collapse;margin-bottom:10px"><thead><tr style="background:#111"><th style="padding:7px 8px;font-size:11px;font-weight:700;text-transform:uppercase;text-align:left;color:#fff">#</th><th style="padding:7px 8px;font-size:11px;font-weight:700;text-transform:uppercase;text-align:left;color:#fff">Description</th></tr></thead><tbody>'+rows+energySealRow+customRows+'</tbody></table>'+totalHtml;
  }).join("");
  return '<div style="font-family:Arial,sans-serif;color:#1a1a1a;padding:24px;max-width:100%;margin:0;width:100%;box-sizing:border-box">'+
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;padding-bottom:14px;border-bottom:3px solid #222"><div><h1 style="font-size:22px;font-weight:800;color:#111;margin-bottom:3px">'+COMPANY.name+'</h1><p style="font-size:12px;color:#666">'+COMPANY.tagline+'</p><p style="font-size:12px;color:#666">'+COMPANY.phone+'</p></div><div style="text-align:right"><div style="font-size:19px;font-weight:700;color:#111">QUOTE</div><div style="font-size:12px;color:#666;margin-top:3px">'+qn+'</div><div style="font-size:12px;color:#666">'+today+'</div></div></div>'+
    '<div style="display:flex;gap:20px;margin-bottom:18px"><div style="flex:1"><div style="font-size:10px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px">Prepared For</div><div style="font-size:14px;font-weight:600">'+(customer.name||"—")+'</div><div style="font-size:12px;color:#666">'+(customer.address||"")+'</div><div style="font-size:12px;color:#666">'+(customer.phone||"")+'</div><div style="font-size:12px;color:#666">'+(customer.email||"")+'</div></div><div style="flex:1"><div style="font-size:10px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px">Project</div><div style="font-size:12px;color:#666">Job Site: '+(customer.jobAddress||customer.address||"—")+'</div><div style="font-size:12px;color:#666">Valid 30 days from quote date</div></div>'+salesHtml+'</div>'+
    optSections+
    '<div style="margin-top:14px;padding-top:12px;border-top:1px solid #ddd;font-size:11px;color:#999;text-align:center">'+COMPANY.name+' &bull; '+COMPANY.phone+'<br/>Helping Oklahoma stay energy efficient—one home at a time.</div></div>';
}

export function generatePDF(customer,opts,salesman,showProductInfo){
  buildQuotePdf(customer,opts,salesman,"save",showProductInfo).catch(function(err){alert("PDF error: "+err.message);});
}

export function printQuoteAndTakeOff(customer,opts,salesman,jobNotes,measurements,quoteOpts,showProductInfo){
  // Build both PDFs then merge pages into one jsPDF doc
  Promise.all([
    buildQuotePdf(customer,opts,salesman,"blob",showProductInfo),
    buildTakeOffPdf(customer,jobNotes,measurements,salesman,quoteOpts,"blob")
  ]).then(function(blobs){
    // Open quote PDF first, then takeoff as separate share — or just share both
    var quoteName="Quote"+(customer.jobAddress||customer.address?" - "+(customer.jobAddress||customer.address):"")+".pdf";
    var takeoffName="TakeOff"+(customer.jobAddress||customer.address?" - "+(customer.jobAddress||customer.address):"")+".pdf";
    var files=[];
    if(blobs[0])files.push(new File([blobs[0]],quoteName,{type:"application/pdf"}));
    if(blobs[1])files.push(new File([blobs[1]],takeoffName,{type:"application/pdf"}));
    if(navigator.canShare&&navigator.canShare({files:files})){
      navigator.share({files:files,title:"Quote & Take Off"}).catch(function(){});
    } else {
      // fallback: download both
      files.forEach(function(f){
        var url=URL.createObjectURL(f);var a=document.createElement("a");a.href=url;a.download=f.name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(url);document.body.removeChild(a);},1000);
      });
    }
  }).catch(function(err){alert("PDF error: "+err.message);});
}

