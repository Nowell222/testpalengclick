import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Send, Users } from "lucide-react";

const CashierSMS = () => {
  const [mode, setMode] = useState<"single" | "bulk">("single");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">SMS Reminders</h1>
        <p className="text-sm text-muted-foreground">Send payment reminders to vendors</p>
      </div>

      <div className="flex rounded-xl bg-secondary p-1 max-w-xs">
        <button onClick={() => setMode("single")} className={`flex-1 rounded-lg py-2 text-sm font-medium ${mode === "single" ? "bg-card text-foreground shadow-civic" : "text-muted-foreground"}`}>Single</button>
        <button onClick={() => setMode("bulk")} className={`flex-1 rounded-lg py-2 text-sm font-medium ${mode === "bulk" ? "bg-card text-foreground shadow-civic" : "text-muted-foreground"}`}>Bulk</button>
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-civic max-w-lg space-y-4">
        {mode === "single" ? (
          <div className="space-y-1.5">
            <Label>Recipient</Label>
            <Input placeholder="Search vendor..." className="h-11 rounded-xl" />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label>Send To</Label>
            <select className="h-11 w-full rounded-xl border bg-background px-3 text-sm">
              <option>Overdue Vendors</option>
              <option>All Vendors</option>
              <option>Fish Section</option>
              <option>Meat Section</option>
            </select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Message</Label>
          <Textarea placeholder="Type reminder message..." className="min-h-[100px] rounded-xl" />
        </div>
        <Button size="lg">
          {mode === "single" ? <Send className="mr-2 h-4 w-4" /> : <Users className="mr-2 h-4 w-4" />}
          {mode === "single" ? "Send SMS" : "Send Bulk SMS"}
        </Button>
      </div>
    </div>
  );
};

export default CashierSMS;
