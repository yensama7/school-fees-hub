import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { lookupStudent, formatCurrency, type Student } from "@/lib/studentData";
import { Plus, Trash2, GraduationCap } from "lucide-react";
import { toast } from "sonner";

declare global {
  interface Window {
    PaystackPop: {
      setup: (options: Record<string, unknown>) => { openIframe: () => void };
    };
  }
}

export function SchoolFeesForm() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [studentIds, setStudentIds] = useState<string[]>([""]);
  const [resolved, setResolved] = useState<Record<number, Student | null>>({});

  const handleStudentIdChange = (index: number, value: string) => {
    const updated = [...studentIds];
    updated[index] = value;
    setStudentIds(updated);

    if (value.trim().length >= 3) {
      const student = lookupStudent(value.trim());
      setResolved((prev) => ({ ...prev, [index]: student }));
    } else {
      setResolved((prev) => {
        const copy = { ...prev };
        delete copy[index];
        return copy;
      });
    }
  };

  const addStudentField = () => {
    setStudentIds([...studentIds, ""]);
  };

  const removeStudentField = (index: number) => {
    if (studentIds.length === 1) return;
    setStudentIds(studentIds.filter((_, i) => i !== index));
    setResolved((prev) => {
      const copy = { ...prev };
      delete copy[index];
      // re-index
      const reindexed: Record<number, Student | null> = {};
      Object.entries(copy).forEach(([k, v]) => {
        const key = Number(k);
        reindexed[key > index ? key - 1 : key] = v;
      });
      return reindexed;
    });
  };

  const resolvedStudents = Object.values(resolved).filter(
    (s): s is Student => s !== null
  );
  const total = resolvedStudents.reduce((sum, s) => sum + s.fees, 0);

  const canPay =
    firstName.trim() &&
    lastName.trim() &&
    email.trim() &&
    resolvedStudents.length > 0;

  const handlePay = () => {
    if (!canPay) return;

    if (!window.PaystackPop) {
      toast.error("Payment system is still loading. Please try again.");
      return;
    }

    try {
    const handler = window.PaystackPop.setup({
      key: "pk_test_513f13a049085892c9481db297e58d15e9743a02",
      email: email.trim(),
      amount: total * 100, // Paystack expects kobo
      currency: "NGN",
      metadata: {
        custom_fields: [
          {
            display_name: "Parent Name",
            variable_name: "parent_name",
            value: `${firstName.trim()} ${lastName.trim()}`,
          },
          {
            display_name: "Students",
            variable_name: "student_ids",
            value: resolvedStudents.map((s) => s.name).join(", "),
          },
        ],
      },
      callback: (response: { reference: string }) => {
        toast.success(`Payment successful! Reference: ${response.reference}`);

        const webhookPayload = {
          parent_first_name: firstName.trim(),
          parent_last_name: lastName.trim(),
          gmail: email.trim(),
          children: resolvedStudents.map((s) => ({ name: s.name })),
          total_amount: total,
          transaction_reference: response.reference,
        };

        void fetch(
          "https://emerie1.app.n8n.cloud/webhook-test/7e4c1dea-18cc-44ef-ab4b-fd010371ede5",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(webhookPayload),
          }
        )
          .then(() => {
            toast.success("Receipt sent to your email.");
          })
          .catch(() => {
            toast.error("Failed to send receipt.");
          });
      },
      onClose: () => {
        toast.info("Payment window closed.");
      },
    });

    handler.openIframe();
    } catch (err) {
      toast.error("Failed to open payment. Please try again or open in a new tab.");
      console.error("Paystack error:", err);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-6">
      {/* Parent Info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">Parent's First Name</Label>
          <Input
            id="firstName"
            placeholder="e.g. Chinedu"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Parent's Last Name</Label>
          <Input
            id="lastName"
            placeholder="e.g. Adeyemi"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Gmail Address</Label>
        <Input
          id="email"
          type="email"
          placeholder="e.g. parent@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      {/* Student IDs */}
      <div className="space-y-3">
        <Label>Student ID(s)</Label>
        {studentIds.map((sid, index) => (
          <div key={index} className="space-y-1">
            <div className="flex gap-2 items-center">
              <Input
                placeholder="e.g. STD001"
                value={sid}
                onChange={(e) => handleStudentIdChange(index, e.target.value)}
              />
              {studentIds.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeStudentField(index)}
                  aria-label="Remove student"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
            {/* Resolved student info */}
            {resolved[index] !== undefined && (
              <div
                className={`text-sm rounded-lg px-3 py-2 flex items-center gap-2 ${
                  resolved[index]
                    ? "bg-secondary text-secondary-foreground"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {resolved[index] ? (
                  <>
                    <GraduationCap className="h-4 w-4 shrink-0" />
                    <span className="font-medium">{resolved[index]!.name}</span>
                    <span className="text-muted-foreground">
                      — {resolved[index]!.grade}
                    </span>
                    <span className="ml-auto font-semibold">
                      {formatCurrency(resolved[index]!.fees)}
                    </span>
                  </>
                ) : (
                  <span>Student not found</span>
                )}
              </div>
            )}
          </div>
        ))}

        <Button
          variant="outline"
          size="sm"
          onClick={addStudentField}
          className="mt-1"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add another student
        </Button>
      </div>

      {/* Total */}
      {resolvedStudents.length > 0 && (
        <div className="flex items-center justify-between border-t border-border pt-4">
          <span className="text-muted-foreground font-medium">Total Fees</span>
          <span className="text-2xl font-bold text-foreground">
            {formatCurrency(total)}
          </span>
        </div>
      )}

      {/* Pay Button */}
      <Button
        variant="pay"
        size="lg"
        className="w-full"
        disabled={!canPay}
        onClick={handlePay}
      >
        Pay Fees
      </Button>
    </div>
  );
}
