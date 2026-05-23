import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, FileText, CheckCircle2, AlertCircle, FileUp, Download, Eye, Clock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface VendorDocumentsManagerProps {
  userId: string;
}

const DOCUMENT_TYPES = [
  "Business Permit",
  "Barangay Clearance",
  "Health Certificate",
  "Police Clearance",
  "DTI Registration",
  "Other"
];

export default function VendorDocumentsManager({ userId }: VendorDocumentsManagerProps) {
  const { role } = useAuth();
  const isReadOnly = role === "eemo";
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState("Business Permit");
  const [expiryDate, setExpiryDate] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // Get vendor ID first
  const { data: vendor, isLoading: vendorLoading } = useQuery({
    queryKey: ["vendor-by-user", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("vendors").select("id").eq("user_id", userId).single();
      if (error) throw error;
      return data;
    }
  });

  const { data: documents, isLoading: docsLoading } = useQuery({
    queryKey: ["vendor-documents", vendor?.id],
    enabled: !!vendor?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_documents")
        .select("*")
        .eq("vendor_id", vendor!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!vendor) throw new Error("Vendor not found");
      if (!file) throw new Error("Please select a file");

      const fileExt = file.name.split('.').pop();
      const fileName = `${vendor.id}/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('vendor_documents')
        .upload(fileName, file);

      if (uploadError) throw new Error("Failed to upload file");

      const { data: urlData } = supabase.storage
        .from('vendor_documents')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase.from("vendor_documents").insert({
        vendor_id: vendor.id,
        document_type: docType,
        file_url: urlData.publicUrl,
        status: "valid",
        expiry_date: expiryDate || null,
      });

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      toast.success("Document uploaded successfully");
      queryClient.invalidateQueries({ queryKey: ["vendor-documents", vendor?.id] });
      setFile(null);
      setExpiryDate("");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const { error } = await supabase.from("vendor_documents").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document status updated");
      queryClient.invalidateQueries({ queryKey: ["vendor-documents", vendor?.id] });
    },
    onError: (error: Error) => toast.error(error.message)
  });

  if (vendorLoading || docsLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!vendor) {
    return <div className="p-4 text-center text-muted-foreground">This user is not a registered vendor.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      {!isReadOnly && (
        <div className="rounded-xl border bg-secondary/20 p-4 space-y-4">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <FileUp className="h-4 w-4 text-blue-500" />
            Upload New Document
          </h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Document Type</Label>
              <select
                className="w-full h-9 rounded-lg border bg-background px-3 text-sm"
                value={docType}
                onChange={e => setDocType(e.target.value)}
              >
                {DOCUMENT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Expiry Date (optional)</Label>
              <Input
                type="date"
                className="h-9 rounded-lg text-sm"
                value={expiryDate}
                onChange={e => setExpiryDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">File</Label>
              <Input
                type="file"
                className="h-9 rounded-lg text-sm"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={e => setFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>
          <Button
            className="w-full sm:w-auto"
            disabled={!file || uploadMutation.isPending}
            onClick={() => uploadMutation.mutate()}
          >
            {uploadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Upload Document
          </Button>
        </div>
      )}

      {/* Document List */}
      <div>
        <h4 className="font-semibold text-sm mb-3">Uploaded Documents</h4>
        {documents?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground bg-secondary/10 rounded-xl border border-dashed">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No documents uploaded yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents?.map(doc => {
              const isExpired = doc.status === "expired" || (doc.expiry_date && new Date(doc.expiry_date) < new Date());
              return (
                <div key={doc.id} className="flex items-center justify-between p-3 rounded-xl border bg-card hover:shadow-sm transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${isExpired ? "bg-red-100 text-red-600" :
                      doc.status === "verified" ? "bg-emerald-100 text-emerald-600" :
                        "bg-blue-100 text-blue-600"
                      }`}>
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-foreground">{doc.document_type}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(doc.created_at).toLocaleDateString()}
                        </span>
                        {doc.expiry_date && (
                          <span className={`flex items-center gap-1 ${isExpired ? 'text-red-500 font-medium' : ''}`}>
                            Exp: {new Date(doc.expiry_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {doc.status === "valid" && !isExpired && !isReadOnly && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        onClick={() => updateStatusMutation.mutate({ id: doc.id, status: "verified" })}
                      >
                        <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Verify
                      </Button>
                    )}

                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center h-8 px-3 rounded-md text-xs font-medium border bg-background hover:bg-secondary transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" /> View
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
