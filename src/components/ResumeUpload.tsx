import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, Building2, TrendingUp, ExternalLink, Loader2 } from 'lucide-react';

interface CompanySuggestion {
  company: string;
  role: string;
  reason: string;
  how_to_reach: string;
  probability_score: number;
  confidence_level: string;
}

interface ResumeAnalysisResponse {
  success: boolean;
  suggestions: CompanySuggestion[];
  error?: string;
}

export const ResumeUpload: React.FC = () => {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CompanySuggestion[] | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes.includes(selectedFile.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a PDF or DOCX file.',
        variant: 'destructive'
      });
      return;
    }

    if (selectedFile.size > maxSize) {
      toast({
        title: 'File too large',
        description: 'Please upload a file smaller than 10MB.',
        variant: 'destructive'
      });
      return;
    }

    setFile(selectedFile);
    setResults(null); // Clear previous results
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      toast({
        title: 'No file selected',
        description: 'Please select a resume file to upload.',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('resume', file);

      const response = await fetch('http://localhost:6969/upload_resume', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ResumeAnalysisResponse = await response.json();

      if (data.success) {
        setResults(data.suggestions);
        toast({
          title: 'Resume analyzed successfully!',
          description: `Found ${data.suggestions.length} job suggestions for you.`
        });
      } else {
        throw new Error(data.error || 'Analysis failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to analyze resume. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'high': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getProbabilityColor = (score: number) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card className="bg-gradient-card shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-accent" />
            Resume Analysis
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Upload your resume to get AI-powered job suggestions and company recommendations
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Drag & Drop Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive 
                ? 'border-accent bg-accent/10' 
                : 'border-border hover:border-accent/50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <div className="space-y-2">
              <p className="text-lg font-medium">
                {file ? file.name : 'Drop your resume here'}
              </p>
              <p className="text-sm text-muted-foreground">
                {file 
                  ? `${(file.size / 1024 / 1024).toFixed(2)} MB • ${file.type.includes('pdf') ? 'PDF' : 'DOCX'}`
                  : 'Supports PDF and DOCX files up to 10MB'
                }
              </p>
            </div>

            {/* File Input */}
            <div className="mt-4">
              <Label htmlFor="resume-upload" className="cursor-pointer">
                <Button variant="outline" className="mt-2" asChild>
                  <span>Choose File</span>
                </Button>
              </Label>
              <input
                id="resume-upload"
                type="file"
                accept=".pdf,.docx"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Upload Button */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Your resume will be analyzed using AI to suggest relevant job opportunities
            </div>
            <Button 
              onClick={handleSubmit} 
              disabled={!file || loading}
              className="flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <TrendingUp className="w-4 h-4" />
                  Analyze Resume
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results Section */}
      {results && (
        <Card className="bg-gradient-card shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-accent" />
              Job Recommendations
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Based on your resume, here are {results.length} companies and roles you should consider
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {results.map((suggestion, index) => (
              <Card key={index} className="p-4 bg-card">
                <div className="space-y-3">
                  {/* Header with Company and Role */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">{suggestion.company}</h3>
                      <p className="text-accent font-medium">{suggestion.role}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getConfidenceColor(suggestion.confidence_level)}>
                        {suggestion.confidence_level} Confidence
                      </Badge>
                      <div className={`text-sm font-semibold ${getProbabilityColor(suggestion.probability_score)}`}>
                        {suggestion.probability_score}% Match
                      </div>
                    </div>
                  </div>

                  {/* Reason */}
                  <p className="text-foreground leading-relaxed">
                    {suggestion.reason}
                  </p>

                  {/* How to Reach */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="text-sm text-muted-foreground">
                      <strong>How to apply:</strong> {suggestion.how_to_reach}
                    </div>
                    {suggestion.how_to_reach.includes('http') && (
                      <Button variant="outline" size="sm" asChild>
                        <a 
                          href={suggestion.how_to_reach} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1"
                        >
                          Apply <ExternalLink className="w-3 h-3" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
 