"use client";

import { useState, useMemo } from "react";
import { 
  FileText, 
  Upload, 
  Trash2, 
  Sparkles, 
  ChevronRight, 
  AlertCircle,
  Loader2,
  TrendingUp,
  Award,
  Zap,
  PlusCircle,
  Download,
  BookOpen,
  Compass,
  Plus,
  Edit2,
  Save,
  Trash,
  Trophy,
  History,
  GraduationCap
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { 
  uploadReportCard, 
  deleteReportCard, 
  createManualReportCard, 
  addSubjectGrade, 
  updateSubjectGrade, 
  deleteSubjectGrade 
} from "@/lib/marks-actions";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

interface SubjectGradeType {
  id: string;
  subject: string;
  grade: string;
  status: string;
  aiFeedback: string;
}

interface ReportCardType {
  id: string;
  term: string;
  overallAverage: number | null;
  aiSummary: string | null;
  fileUrl: string | null;
  createdAt: Date;
  grades: SubjectGradeType[];
}

export function MarksClient({ 
  initialReportCards, 
  currentTermSetting,
  subjects = []
}: { 
  initialReportCards: ReportCardType[], 
  currentTermSetting: string,
  subjects?: { id: string; name: string }[]
}) {
  const [selectedTerm, setSelectedTerm] = useState(currentTermSetting);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTerm, setUploadTerm] = useState(currentTermSetting);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  
  // Manual actions states
  const [isCreateTermOpen, setIsCreateTermOpen] = useState(false);
  const [newTermName, setNewTermName] = useState("");
  const [isCreatingTerm, setIsCreatingTerm] = useState(false);
  
  const [isAddingGrade, setIsAddingGrade] = useState(false);
  const [isSavingGrade, setIsSavingGrade] = useState(false);
  const [newGradeForm, setNewGradeForm] = useState({
    subject: "",
    grade: "",
    status: "Good",
    aiFeedback: ""
  });

  const [editingGradeId, setEditingGradeId] = useState<string | null>(null);
  const [isUpdatingGrade, setIsUpdatingGrade] = useState(false);
  const [editForm, setEditForm] = useState({
    subject: "",
    grade: "",
    status: "Good",
    aiFeedback: ""
  });

  // Active subject grade for the detail modal
  const [selectedGradeDetail, setSelectedGradeDetail] = useState<SubjectGradeType | null>(null);

  const availableTerms = useMemo(() => {
    const terms = Array.from(new Set(initialReportCards.map(rc => rc.term)));
    if (!terms.includes(currentTermSetting)) {
      terms.push(currentTermSetting);
    }
    return terms.sort();
  }, [initialReportCards, currentTermSetting]);

  const activeReportCard = initialReportCards.find(rc => rc.term === selectedTerm);

  const parseGrade = (grade: string | number): number => {
    if (typeof grade === 'number') return grade;
    const num = parseFloat(grade.replace(/[^0-9.]/g, ''));
    return isNaN(num) ? 0 : num;
  };

  const getLetterGrade = (gradeStr: string): string => {
    const score = parseGrade(gradeStr);
    if (score >= 95) return "A+";
    if (score >= 90) return "A";
    if (score >= 85) return "B+";
    if (score >= 80) return "B";
    if (score >= 75) return "C+";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    return "F";
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !uploadTerm) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("term", uploadTerm);

    try {
      const result = await uploadReportCard(formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        setUploadFile(null);
        setIsUploadModalOpen(false);
        setSelectedTerm(uploadTerm);
        toast.success("Document analyzed and grades successfully logged.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to process document.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTermName.trim()) return;

    setIsCreatingTerm(true);
    try {
      const result = await createManualReportCard(newTermName.trim());
      if (result.error) {
        toast.error(result.error);
      } else {
        setSelectedTerm(newTermName.trim());
        setNewTermName("");
        setIsCreateTermOpen(false);
        toast.success(`Academic term "${newTermName.trim()}" created.`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create term.");
    } finally {
      setIsCreatingTerm(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this term? All logged grades will be permanently deleted.")) return;
    try {
      await deleteReportCard(id);
      toast.success("Academic term deleted.");
      const remaining = availableTerms.filter(t => t !== selectedTerm);
      if (remaining.length > 0) {
        setSelectedTerm(remaining[0]);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete term.");
    }
  };

  const handleAddGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReportCard || !newGradeForm.subject.trim() || !newGradeForm.grade.trim()) return;

    setIsSavingGrade(true);
    try {
      const result = await addSubjectGrade(activeReportCard.id, {
        subject: newGradeForm.subject.trim(),
        grade: newGradeForm.grade.trim(),
        status: newGradeForm.status,
        aiFeedback: newGradeForm.aiFeedback.trim() || "Consistently work on course materials."
      });

      if (result.success) {
        setIsAddingGrade(false);
        setNewGradeForm({ subject: "", grade: "", status: "Good", aiFeedback: "" });
        toast.success("Grade added successfully.");
      } else {
        toast.error("Failed to add grade.");
      }
    } catch (err: any) {
      toast.error(err.message || "Error adding grade.");
    } finally {
      setIsSavingGrade(false);
    }
  };

  const handleStartEdit = (grade: SubjectGradeType) => {
    setEditingGradeId(grade.id);
    setEditForm({
      subject: grade.subject,
      grade: grade.grade,
      status: grade.status,
      aiFeedback: grade.aiFeedback
    });
  };

  const handleUpdateGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGradeId) return;

    setIsUpdatingGrade(true);
    try {
      const result = await updateSubjectGrade(editingGradeId, {
        subject: editForm.subject.trim(),
        grade: editForm.grade.trim(),
        status: editForm.status,
        aiFeedback: editForm.aiFeedback.trim() || "Consistently work on course materials."
      });

      if (result.success) {
        setEditingGradeId(null);
        setSelectedGradeDetail(null);
        toast.success("Subject details updated.");
      } else {
        toast.error("Failed to update subject.");
      }
    } catch (err: any) {
      toast.error(err.message || "Error updating subject.");
    } finally {
      setIsUpdatingGrade(false);
    }
  };

  const handleDeleteGrade = async (id: string) => {
    if (!confirm("Are you sure you want to delete this subject grade?")) return;
    try {
      await deleteSubjectGrade(id);
      setSelectedGradeDetail(null);
      toast.success("Subject deleted.");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete subject.");
    }
  };

  const allTermsHistory = useMemo(() => {
    return initialReportCards
      .map(rc => ({
        id: rc.id,
        term: rc.term,
        average: rc.overallAverage || 0,
        subjectCount: rc.grades?.length || 0,
        date: new Date(rc.createdAt).getTime(),
        aiSummary: rc.aiSummary
      }))
      .sort((a, b) => a.date - b.date);
  }, [initialReportCards]);

  const bestTerm = useMemo(() => {
    if (allTermsHistory.length === 0) return null;
    return [...allTermsHistory].sort((a, b) => b.average - a.average)[0];
  }, [allTermsHistory]);

  const termProgressTrend = useMemo(() => {
    if (allTermsHistory.length < 2) return "Stable";
    const last = allTermsHistory[allTermsHistory.length - 1].average;
    const prev = allTermsHistory[allTermsHistory.length - 2].average;
    const diff = last - prev;
    if (diff > 0.5) return `+${diff.toFixed(1)}% Gain`;
    if (diff < -0.5) return `${diff.toFixed(1)}% Decline`;
    return "Stable";
  }, [allTermsHistory]);

  const getStandingStatus = (avg: number) => {
    if (avg >= 85) return "First Class Honors";
    if (avg >= 70) return "Excellent Standing";
    if (avg >= 55) return "Good Standing";
    return "Needs Focus";
  };

  // Derive metrics
  const activeMetrics = useMemo(() => {
    if (!activeReportCard || !activeReportCard.grades || activeReportCard.grades.length === 0) {
      return { highest: null, focusNeeded: null, passingRatio: "0/0" };
    }
    const list = activeReportCard.grades.map(g => ({
      subject: g.subject,
      score: parseGrade(g.grade),
      status: g.status
    }));

    const highest = [...list].sort((a, b) => b.score - a.score)[0];
    
    const critical = list.find(g => g.status === "Critical");
    const needsWork = list.find(g => g.status === "Needs Work");
    const lowest = [...list].sort((a, b) => a.score - b.score)[0];
    const focusNeeded = critical || needsWork || lowest;

    const passing = list.filter(g => g.score >= 50).length;
    const passingRatio = `${passing}/${list.length}`;

    return { highest, focusNeeded, passingRatio };
  }, [activeReportCard]);

  const exportPDF = () => {
    if (!activeReportCard) return;
    const doc = new jsPDF();
    
    doc.setFontSize(22);
    doc.text("Academic Performance Record", 14, 20);
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Term: ${selectedTerm}`, 14, 30);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 37);
    
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("Academic Strategy & Overview Summary", 14, 50);
    doc.setFontSize(10);
    doc.setTextColor(80);
    const summaryLines = doc.splitTextToSize(activeReportCard.aiSummary || "No summary available.", 180);
    doc.text(summaryLines, 14, 57);
    
    autoTable(doc, {
      startY: 75,
      head: [["Subject", "Grade (%)", "Standing", "Target Study Strategy Guidelines"]],
      body: activeReportCard.grades.map((g: any) => [
        g.subject, 
        g.grade, 
        g.status, 
        g.aiFeedback
      ]),
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 9, cellPadding: 5 }
    });
    
    doc.save(`Academic_Report_${selectedTerm.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="space-y-10 max-w-[1600px] mx-auto animate-in fade-in duration-500 pb-20">
      
      {/* Top Ribbon Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-border/40">
        <div className="flex items-center gap-3.5 flex-wrap">
          <Select value={selectedTerm} onValueChange={setSelectedTerm}>
            <SelectTrigger className="w-[200px] h-11 rounded-xl bg-card border-border/50 font-bold text-sm shadow-sm hover:border-primary/45 transition-colors">
              <SelectValue placeholder="Select Term" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border bg-card">
              {availableTerms.map(term => (
                <SelectItem key={term} value={term} className="font-bold cursor-pointer">
                  {term}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Dialog open={isCreateTermOpen} onOpenChange={setIsCreateTermOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-11 rounded-xl font-bold gap-2 hover:border-primary/45 transition-colors">
                <PlusCircle className="w-4 h-4 text-primary" /> Create Term
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px] rounded-3xl border-border bg-card p-6 shadow-xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-heading font-black tracking-tight uppercase">New Study Term</DialogTitle>
                <p className="text-muted-foreground text-sm font-semibold">Initialize a new school term manually.</p>
              </DialogHeader>
              <form onSubmit={handleCreateTerm} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-muted-foreground">Term Name</Label>
                  <Input 
                    required
                    value={newTermName}
                    onChange={(e) => setNewTermName(e.target.value)}
                    placeholder="e.g., Term 2 2026"
                    className="h-11 rounded-xl bg-muted/30 border-border/50 font-bold focus-visible:ring-1 focus-visible:ring-primary/25"
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={isCreatingTerm || !newTermName.trim()} 
                  className="w-full h-11 rounded-xl font-bold cursor-pointer"
                >
                  {isCreatingTerm ? <Loader2 className="w-5 h-5 animate-spin" /> : "Initialize Term"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {activeReportCard && (
            <>
              <Button 
                variant="outline"
                onClick={exportPDF}
                className="h-11 px-4 rounded-xl font-bold gap-2 border-border/50 hover:bg-muted/50 transition-all shadow-sm cursor-pointer"
              >
                <Download className="w-4 h-4" /> Export Report Card
              </Button>
              
              <Button 
                variant="ghost"
                onClick={() => handleDelete(activeReportCard.id)}
                className="h-11 px-4 rounded-xl font-bold gap-2 text-destructive hover:bg-destructive/10 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" /> Delete Term
              </Button>
            </>
          )}

          <div className="h-6 w-px bg-border/60 mx-1 hidden md:block" />

          <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
            <DialogTrigger asChild>
              <Button className="h-11 px-5 rounded-xl font-bold gap-2 shadow-md shadow-primary/10 hover:shadow-primary/25 cursor-pointer bg-gradient-to-r from-primary to-indigo-600 border-none hover:opacity-90">
                <Upload className="w-4 h-4" /> Scan Transcript File
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[440px] rounded-[32px] border-border bg-card p-8 shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-heading font-black tracking-tight text-center uppercase">Scan Transcript Document</DialogTitle>
                <p className="text-center text-muted-foreground text-sm font-semibold">Upload your transcript or report file to automatically extract grades.</p>
              </DialogHeader>
              <form onSubmit={handleUpload} className="space-y-6 pt-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black text-primary uppercase tracking-[0.2em] ml-1">Target Academic Term</Label>
                  <Input 
                    required
                    value={uploadTerm}
                    onChange={(e) => setUploadTerm(e.target.value)}
                    placeholder="e.g., Term 1 2026"
                    className="h-11 rounded-xl bg-muted/30 border-border/50 font-bold focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black text-primary uppercase tracking-[0.2em] ml-1">Document File</Label>
                  <div className="relative group">
                    <input 
                      type="file" 
                      accept=".pdf,image/*,.docx" 
                      required 
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      className="hidden" 
                      id="report-upload"
                    />
                    <label 
                      htmlFor="report-upload"
                      className={cn(
                        "flex flex-col items-center justify-center w-full min-h-[160px] border-2 border-dashed border-border/50 rounded-[20px] cursor-pointer transition-all duration-300",
                        uploadFile 
                          ? "bg-primary/5 border-primary shadow-[0_0_20px_rgba(var(--primary),0.05)]" 
                          : "bg-muted/10 border-border hover:bg-muted/20 hover:border-primary/45"
                      )}
                    >
                      {uploadFile ? (
                        <div className="flex flex-col items-center gap-3 p-4 text-center animate-in fade-in zoom-in duration-300">
                          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                            <FileText className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-sm font-black truncate max-w-[280px]">{uploadFile.name}</p>
                            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-wider mt-1">Ready for extract</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-3 p-4 text-center text-muted-foreground group-hover:text-primary transition-colors">
                          <div className="w-12 h-12 bg-muted/50 rounded-full flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                            <Upload className="w-5 h-5" />
                          </div>
                          <p className="text-sm font-bold">Drop your file here, or click to browse</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={isUploading || !uploadFile}
                  className="w-full h-12 rounded-xl font-bold text-base shadow-lg shadow-primary/15 cursor-pointer bg-gradient-to-r from-primary to-indigo-600 border-none hover:opacity-90"
                >
                  {isUploading ? (
                    <span className="flex items-center gap-2 justify-center">
                      <Loader2 className="w-5 h-5 animate-spin" /> Scanning Transcript...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 justify-center">
                      <Sparkles className="w-5 h-5 text-yellow-400 fill-yellow-400" /> Start Extraction Scan
                    </span>
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!activeReportCard ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="py-24 flex flex-col items-center justify-center text-center border border-border/40 rounded-[32px] bg-card/45 relative overflow-hidden group shadow-md"
        >
           <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
           <div className="w-16 h-16 bg-muted/50 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6 border border-border/50 group-hover:scale-105 transition-transform duration-500">
              <Award className="w-8 h-8 text-primary/45" />
           </div>
           <h3 className="text-2xl font-heading font-black tracking-tight text-foreground uppercase">No Grades Logged</h3>
           <p className="text-muted-foreground mt-2 max-w-sm font-semibold leading-relaxed text-sm">
             Initialize this term by scanning a report card document or creating manual subjects.
           </p>
           <div className="flex gap-4 mt-8">
             <Button 
               variant="outline" 
               onClick={() => setIsUploadModalOpen(true)}
               className="rounded-xl h-11 px-5 font-bold border-border/50 hover:bg-primary/5 hover:text-primary transition-all cursor-pointer"
             >
               Scan Document
             </Button>
             <Button 
               onClick={() => setIsCreateTermOpen(true)}
               className="rounded-xl h-11 px-5 font-bold transition-all shadow-sm cursor-pointer"
             >
               Add Term Manually
             </Button>
           </div>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: Core stats, term average progress track & history graph (col-span-5) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* The GPA Dashboard Display */}
            <Card className="p-8 border-border/40 shadow-xl rounded-[32px] bg-card/40 backdrop-blur-xl relative overflow-hidden flex flex-col justify-between min-h-[220px]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary rounded-full blur-3xl -z-10 opacity-[0.03] translate-x-1/3 -translate-y-1/3" />
              
              <div className="space-y-4">
                <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em]">Term Cumulative Average</p>
                <div className="relative flex items-baseline gap-3">
                  <span className="text-6xl font-heading font-black tracking-tighter text-foreground drop-shadow-[0_0_20px_rgba(var(--primary),0.15)] leading-none">
                    {activeReportCard.overallAverage?.toFixed(1) || 0}%
                  </span>
                  <span className="text-xs font-black text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-full uppercase tracking-wider leading-none">
                    {getStandingStatus(activeReportCard.overallAverage || 0)}
                  </span>
                </div>
              </div>

              {/* Progress Range Track Slider (Replaces standard circle icon) */}
              <div className="mt-8 space-y-2">
                <div className="h-2 w-full bg-muted/40 rounded-full overflow-hidden border border-border/10 relative">
                  <div 
                    className="h-full bg-gradient-to-r from-primary to-indigo-500 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${Math.min(activeReportCard.overallAverage || 0, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[8px] font-black text-muted-foreground/50 uppercase tracking-widest px-0.5">
                  <span>0% Fail</span>
                  <span>50% Pass</span>
                  <span>75% Credit</span>
                  <span>100% Elite</span>
                </div>
              </div>
            </Card>

            {/* Quick Metrics Widget */}
            <div className="bg-card/40 backdrop-blur-xl border border-border/40 shadow-xl rounded-[32px] p-6 space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 border-b border-border/30 pb-3">Academic Milestones</h4>
              <div className="grid grid-cols-1 gap-3">
                <div className="bg-muted/20 border border-border/30 rounded-xl p-4.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/60 leading-none">Top Performance</p>
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                  {activeMetrics.highest ? (
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="text-base font-black truncate max-w-[150px] uppercase">{activeMetrics.highest.subject}</span>
                      <span className="text-base font-heading font-black text-amber-500">{activeMetrics.highest.score}%</span>
                    </div>
                  ) : (
                    <p className="text-xs font-bold text-muted-foreground mt-1">None registered</p>
                  )}
                </div>

                <div className="bg-muted/20 border border-border/30 rounded-xl p-4.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/60 leading-none">Focus Priority</p>
                    <Zap className="w-3.5 h-3.5 text-orange-500" />
                  </div>
                  {activeMetrics.focusNeeded ? (
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="text-base font-black truncate max-w-[150px] uppercase">{activeMetrics.focusNeeded.subject}</span>
                      <span className="text-base font-heading font-black text-orange-500">{activeMetrics.focusNeeded.score}%</span>
                    </div>
                  ) : (
                    <p className="text-xs font-bold text-muted-foreground mt-1">None registered</p>
                  )}
                </div>

                <div className="bg-muted/20 border border-border/30 rounded-xl p-4.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/60 leading-none">Passing Rate</p>
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-base font-black">Subjects (≥50%)</span>
                    <span className="text-base font-heading font-black text-emerald-500">{activeMetrics.passingRatio}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Historical Progression Graph */}
            {allTermsHistory.length > 1 && (
              <div className="bg-card/40 backdrop-blur-xl border border-border/40 shadow-xl rounded-[28px] p-6.5 space-y-4 animate-in fade-in duration-700">
                <div className="flex sm:items-center justify-between gap-4 border-b border-border/30 pb-3">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-primary" />
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Historical Progression</h4>
                  </div>
                  <span className="text-[9px] font-black text-primary uppercase tracking-widest bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full">
                    Trend: {termProgressTrend}
                  </span>
                </div>

                <div className="h-[180px] w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={allTermsHistory} margin={{ top: 5, right: 5, left: -32, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorAvgCrossMinimal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(var(--primary), 0.05)" />
                      <XAxis 
                        dataKey="term" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 8, fontWeight: 800, fill: 'currentColor', opacity: 0.5 }}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 8, fontWeight: 800, fill: 'currentColor', opacity: 0.5 }}
                        domain={[0, 100]}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          borderRadius: '12px', 
                          border: '1px solid rgba(var(--border), 0.5)', 
                          backgroundColor: 'rgba(var(--card), 0.95)',
                          backdropFilter: 'blur(8px)',
                          fontWeight: 900,
                          fontSize: '10px'
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="average" 
                        stroke="var(--primary)" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorAvgCrossMinimal)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

          </div>

          {/* RIGHT COLUMN: Performance Strategy guidelines & Courses Ledger (col-span-7) */}
          <div className="lg:col-span-7 space-y-6">

            {/* Strategic Overview Brief */}
            <div className="bg-card/40 backdrop-blur-xl border border-border/40 shadow-xl rounded-[32px] p-8 relative overflow-hidden flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-primary font-bold">
                  <BookOpen className="w-5 h-5 text-primary" />
                  <span className="text-[10px] font-black uppercase tracking-[0.25em]">Strategic Academic Summary</span>
                </div>
                <div className="relative pl-5 py-1 border-l-2 border-primary/20">
                  <p className="text-sm font-medium text-foreground/80 leading-relaxed italic">
                    "{activeReportCard.aiSummary || "Add manual subjects or scan a report card to see your performance summary."}"
                  </p>
                </div>
              </div>
            </div>

            {/* Course Standings Ledger Entries (Interactive row list layout) */}
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-4 border-b border-border/40 pb-4">
                <div>
                  <h2 className="text-xl font-heading font-black tracking-tight text-foreground uppercase">Course Ledger Entries</h2>
                  <p className="text-xs text-muted-foreground font-semibold">Interactive index of registered subjects.</p>
                </div>

                <Dialog open={isAddingGrade} onOpenChange={setIsAddingGrade}>
                  <DialogTrigger asChild>
                    <Button className="h-9 rounded-xl font-bold gap-1.5 cursor-pointer shadow-sm text-xs">
                      <Plus className="w-3.5 h-3.5" /> Add Subject
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[460px] rounded-3xl border-border bg-card p-6 shadow-xl">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-heading font-black tracking-tight uppercase">Add Subject Grade</DialogTitle>
                      <p className="text-muted-foreground text-sm font-semibold">Add a new grade entry to this term's record.</p>
                    </DialogHeader>
                    <form onSubmit={handleAddGrade} className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-muted-foreground">Subject Name</Label>
                        {subjects && subjects.length > 0 ? (
                          <Select
                            value={newGradeForm.subject}
                            onValueChange={(val) => setNewGradeForm(prev => ({ ...prev, subject: val }))}
                          >
                            <SelectTrigger className="h-11 rounded-xl bg-muted/30 border-border/50 font-bold focus:ring-1 focus:ring-primary/25">
                              <SelectValue placeholder="Select Subject" />
                            </SelectTrigger>
                            <SelectContent>
                              {subjects.map((sub) => (
                                <SelectItem key={sub.id} value={sub.name}>
                                  {sub.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input 
                            required
                            value={newGradeForm.subject}
                            onChange={(e) => setNewGradeForm(prev => ({ ...prev, subject: e.target.value }))}
                            placeholder="e.g. Physics"
                            className="h-11 rounded-xl bg-muted/30 border-border/50 font-bold focus-visible:ring-1 focus-visible:ring-primary/25"
                          />
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-muted-foreground">Grade (%)</Label>
                          <Input 
                            required
                            value={newGradeForm.grade}
                            onChange={(e) => setNewGradeForm(prev => ({ ...prev, grade: e.target.value }))}
                            placeholder="e.g. 92%"
                            className="h-11 rounded-xl bg-muted/30 border-border/50 font-bold focus-visible:ring-1 focus-visible:ring-primary/25"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-muted-foreground">Standing Status</Label>
                          <Select 
                            value={newGradeForm.status} 
                            onValueChange={(val) => setNewGradeForm(prev => ({ ...prev, status: val }))}
                          >
                            <SelectTrigger className="h-11 rounded-xl bg-muted/30 border-border/50 font-bold">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl bg-card">
                              <SelectItem value="Excellent" className="font-bold">Excellent</SelectItem>
                              <SelectItem value="Good" className="font-bold">Good</SelectItem>
                              <SelectItem value="Needs Work" className="font-bold">Needs Work</SelectItem>
                              <SelectItem value="Critical" className="font-bold">Critical</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-muted-foreground">Study Action Plan Guidelines</Label>
                        <Input 
                          value={newGradeForm.aiFeedback}
                          onChange={(e) => setNewGradeForm(prev => ({ ...prev, aiFeedback: e.target.value }))}
                          placeholder="e.g. Practice problem solving daily."
                          className="h-11 rounded-xl bg-muted/30 border-border/50 font-bold focus-visible:ring-1 focus-visible:ring-primary/25"
                        />
                      </div>
                      <Button 
                        type="submit" 
                        disabled={isSavingGrade || !newGradeForm.subject.trim() || !newGradeForm.grade.trim()}
                        className="w-full h-11 rounded-xl font-bold mt-2 cursor-pointer"
                      >
                        {isSavingGrade ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Subject"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Subject Ledger Rows */}
              <div className="space-y-3.5">
                {activeReportCard.grades?.length === 0 ? (
                  <div className="py-16 text-center text-muted-foreground font-semibold bg-muted/10 border border-dashed border-border/50 rounded-2xl">
                    No subjects registered. Click "Add Subject" to begin manually.
                  </div>
                ) : (
                  activeReportCard.grades.map((grade: any) => {
                    const scoreNum = parseGrade(grade.grade);
                    const letterGrade = getLetterGrade(grade.grade);
                    return (
                      <Dialog 
                        key={grade.id}
                        open={selectedGradeDetail?.id === grade.id}
                        onOpenChange={(open) => {
                          if (!open) {
                            setSelectedGradeDetail(null);
                            setEditingGradeId(null);
                          } else {
                            setSelectedGradeDetail(grade);
                          }
                        }}
                      >
                        <DialogTrigger asChild>
                          <motion.div
                            whileHover={{ scale: 1.005 }}
                            whileTap={{ scale: 0.995 }}
                            className={cn(
                              "group bg-card/30 hover:bg-card/65 border border-border/30 hover:border-primary/45 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-5 cursor-pointer transition-all duration-300 relative overflow-hidden"
                            )}
                          >
                            {/* Inner gradient indicator */}
                            <div className={cn(
                              "absolute inset-y-0 left-0 w-1 group-hover:w-1.5 transition-all duration-300",
                              grade.status === 'Excellent' ? "bg-emerald-500" :
                              grade.status === 'Needs Work' ? "bg-orange-500" :
                              grade.status === 'Critical' ? "bg-red-500" :
                              "bg-primary"
                            )} />

                            {/* Info Block */}
                            <div className="flex-1 min-w-0 space-y-1 md:pl-2">
                              <div className="flex items-center gap-3">
                                <h3 className="text-lg font-heading font-black tracking-tight text-foreground uppercase group-hover:text-primary transition-colors">
                                  {grade.subject}
                                </h3>
                                <span className={cn(
                                  "text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded border leading-none",
                                  grade.status === 'Excellent' ? "text-emerald-500 border-emerald-500/20 bg-emerald-500/5" :
                                  grade.status === 'Needs Work' ? "text-orange-500 border-orange-500/20 bg-orange-500/5" :
                                  grade.status === 'Critical' ? "text-red-500 border-red-500/20 bg-red-500/5" :
                                  "text-primary border-primary/20 bg-primary/5"
                                )}>
                                  {grade.status}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground/80 font-medium truncate max-w-lg">
                                {grade.aiFeedback || "Consistently work on course materials."}
                              </p>
                            </div>

                            {/* Score & Letter Grade display */}
                            <div className="flex items-center gap-6 shrink-0 justify-between md:justify-end">
                              <div className="text-right">
                                <div className="flex items-baseline gap-1 justify-end">
                                  <span className="text-2xl font-heading font-black tracking-tighter leading-none">{grade.grade}</span>
                                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">%</span>
                                </div>
                                <div className="h-1 w-24 bg-muted/40 rounded-full overflow-hidden border border-border/10 mt-1.5">
                                  <div 
                                    className={cn(
                                      "h-full rounded-full transition-all duration-500",
                                      grade.status === 'Excellent' ? "bg-emerald-500" :
                                      grade.status === 'Needs Work' ? "bg-orange-500" :
                                      grade.status === 'Critical' ? "bg-red-500" :
                                      "bg-primary"
                                    )}
                                    style={{ width: `${Math.min(scoreNum, 100)}%` }}
                                  />
                                </div>
                              </div>

                              <span className={cn(
                                "text-sm font-black w-9 h-9 rounded-xl border flex items-center justify-center leading-none font-heading shadow-inner shrink-0",
                                grade.status === 'Excellent' ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/10" :
                                grade.status === 'Needs Work' ? "text-orange-500 border-orange-500/30 bg-orange-500/10" :
                                grade.status === 'Critical' ? "text-red-500 border-red-500/30 bg-red-500/10" :
                                "text-primary border-primary/30 bg-primary/10"
                              )}>
                                {letterGrade}
                              </span>

                              <ChevronRight className="w-5 h-5 text-muted-foreground/30 group-hover:text-foreground group-hover:translate-x-0.5 transition-all hidden md:block" />
                            </div>
                          </motion.div>
                        </DialogTrigger>

                        {/* Grade details modal overlay */}
                        <DialogContent className="sm:max-w-[480px] rounded-[28px] border-border bg-card p-6 shadow-2xl">
                          {editingGradeId === grade.id ? (
                            <form onSubmit={handleUpdateGrade} className="space-y-4">
                              <DialogHeader>
                                <DialogTitle className="text-xl font-heading font-black uppercase">Edit Subject details</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-3 pt-2">
                                <div className="space-y-1">
                                  <Label className="text-xs font-bold text-muted-foreground">Subject Name</Label>
                                  {subjects && subjects.length > 0 ? (
                                    <Select
                                      value={editForm.subject}
                                      onValueChange={(val) => setEditForm(prev => ({ ...prev, subject: val }))}
                                    >
                                      <SelectTrigger className="h-10 rounded-xl bg-muted/30 border-border/50 font-bold focus:ring-1 focus:ring-primary/25">
                                        <SelectValue placeholder="Select Subject" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {subjects.map((sub) => (
                                          <SelectItem key={sub.id} value={sub.name}>
                                            {sub.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <Input 
                                      required
                                      value={editForm.subject}
                                      onChange={(e) => setEditForm(prev => ({ ...prev, subject: e.target.value }))}
                                      className="h-10 rounded-xl bg-muted/30 border-border/50 font-bold focus-visible:ring-1 focus-visible:ring-primary/25"
                                    />
                                  )}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <Label className="text-xs font-bold text-muted-foreground">Grade (%)</Label>
                                    <Input 
                                      required
                                      value={editForm.grade}
                                      onChange={(e) => setEditForm(prev => ({ ...prev, grade: e.target.value }))}
                                      className="h-10 rounded-xl bg-muted/30 border-border/50 font-bold focus-visible:ring-1 focus-visible:ring-primary/25"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs font-bold text-muted-foreground">Standing Status</Label>
                                    <Select 
                                      value={editForm.status} 
                                      onValueChange={(val) => setEditForm(prev => ({ ...prev, status: val }))}
                                    >
                                      <SelectTrigger className="h-10 rounded-xl bg-muted/30 border-border/50 font-bold">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent className="rounded-xl bg-card">
                                        <SelectItem value="Excellent" className="font-bold">Excellent</SelectItem>
                                        <SelectItem value="Good" className="font-bold">Good</SelectItem>
                                        <SelectItem value="Needs Work" className="font-bold">Needs Work</SelectItem>
                                        <SelectItem value="Critical" className="font-bold">Critical</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs font-bold text-muted-foreground">Study Action Plan Guidelines</Label>
                                  <Input 
                                    value={editForm.aiFeedback}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, aiFeedback: e.target.value }))}
                                    className="h-10 rounded-xl bg-muted/30 border-border/50 font-bold focus-visible:ring-1 focus-visible:ring-primary/25"
                                  />
                                </div>
                              </div>
                              
                              <div className="flex gap-3 pt-4">
                                <Button 
                                  type="submit" 
                                  disabled={isUpdatingGrade}
                                  className="flex-1 h-11 rounded-xl font-bold gap-2 cursor-pointer"
                                >
                                  {isUpdatingGrade ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                  Save Changes
                                </Button>
                                <Button 
                                  type="button" 
                                  variant="outline"
                                  onClick={() => setEditingGradeId(null)}
                                  className="h-11 rounded-xl font-bold px-4 border-border/50 cursor-pointer"
                                >
                                  Cancel
                                </Button>
                              </div>
                            </form>
                          ) : (
                            <div className="space-y-5">
                              <DialogHeader>
                                <div className="flex items-center justify-between mb-2">
                                  <span className={cn(
                                    "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border leading-none",
                                    grade.status === 'Excellent' ? "text-emerald-500 border-emerald-500/20 bg-emerald-500/5" :
                                    grade.status === 'Needs Work' ? "text-orange-500 border-orange-500/20 bg-orange-500/5" :
                                    grade.status === 'Critical' ? "text-red-500 border-red-500/20 bg-red-500/5" :
                                    "text-primary border-primary/20 bg-primary/5"
                                  )}>
                                    {grade.status}
                                  </span>

                                  <span className="text-xs font-black text-muted-foreground/60 uppercase tracking-widest">
                                    Grade {letterGrade}
                                  </span>
                                </div>
                                <DialogTitle className="text-2xl font-heading font-black tracking-tight uppercase">{grade.subject}</DialogTitle>
                              </DialogHeader>

                              <div className="flex items-baseline gap-1 py-4 border-b border-border/40">
                                <span className="text-5xl font-heading font-black tracking-tighter leading-none">{grade.grade}</span>
                                <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">% Score</span>
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                  <Compass className="w-4 h-4 text-primary" />
                                  <h4 className="text-[10px] font-black uppercase tracking-widest">Target Study Strategy</h4>
                                </div>
                                <div className="bg-muted/30 border border-border/40 p-4.5 rounded-xl relative overflow-hidden">
                                  <p className="text-sm font-medium leading-relaxed italic text-foreground/80">
                                    "{grade.aiFeedback || "Consistently work on course materials."}"
                                  </p>
                                </div>
                              </div>

                              <div className="flex gap-3 pt-5 border-t border-border/40">
                                <Button 
                                  onClick={() => handleStartEdit(grade)}
                                  variant="outline"
                                  className="flex-1 h-11 rounded-xl font-bold gap-2 border-border/50 hover:bg-muted/50 transition-all cursor-pointer"
                                >
                                  <Edit2 className="w-4 h-4" /> Edit Subject
                                </Button>
                                <Button 
                                  onClick={() => handleDeleteGrade(grade.id)}
                                  variant="ghost"
                                  className="h-11 px-4 rounded-xl font-bold gap-2 text-destructive hover:bg-destructive/10 transition-all cursor-pointer"
                                  disabled={editingGradeId === grade.id}
                                >
                                  <Trash className="w-4 h-4" /> Delete
                                </Button>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    );
                  })
                )}
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
}
