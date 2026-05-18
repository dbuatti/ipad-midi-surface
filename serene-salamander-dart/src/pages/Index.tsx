import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExternalLink, Video, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface Lesson {
  category: string;
  title: string;
  page_url: string;
  video_url: string | null;
}

const Index = () => {
  const [jsonInput, setJsonInput] = useState('');
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [copied, setCopied] = useState(false);

  const handleParse = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      if (Array.isArray(parsed)) {
        setLessons(parsed);
        toast.success(`Loaded ${parsed.length} lessons`);
      } else {
        toast.error("Invalid format: Expected an array of lessons");
      }
    } catch (e) {
      toast.error("Invalid JSON");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="container mx-auto py-10 px-4 max-w-6xl">
      <div className="flex flex-col gap-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Course Data Viewer</h1>
          <p className="text-muted-foreground">Paste your crawler results below to visualize and manage your course content.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Import JSON Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <textarea
              className="w-full h-32 p-3 rounded-md border bg-muted/50 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder='Paste JSON here... [{"category": "...", "title": "...", "video_url": "..."}]'
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
            />
            <Button onClick={handleParse} className="w-full">
              Parse & View Lessons
            </Button>
          </CardContent>
        </Card>

        {lessons.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{lessons.length} Lessons Found</CardTitle>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  copyToClipboard(JSON.stringify(lessons, null, 2));
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                Copy All JSON
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Category</TableHead>
                      <TableHead>Lesson Title</TableHead>
                      <TableHead className="text-center">Video</TableHead>
                      <TableHead className="text-right">Links</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lessons.map((lesson, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium text-xs text-muted-foreground uppercase tracking-wider">
                          {lesson.category}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {lesson.title}
                        </TableCell>
                        <TableCell className="text-center">
                          {lesson.video_url ? (
                            <div className="flex justify-center">
                              <a 
                                href={lesson.video_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-primary hover:text-primary/80 transition-colors"
                                title="Open Video"
                              >
                                <Video className="h-5 w-5" />
                              </a>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs italic">No video</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              asChild
                              title="Open Lesson Page"
                            >
                              <a href={lesson.page_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Index;
