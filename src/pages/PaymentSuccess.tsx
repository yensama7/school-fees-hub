import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function PaymentSuccess() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center space-y-6 max-w-md">
        <CheckCircle className="h-20 w-20 text-primary mx-auto" />
        <h1 className="text-3xl font-bold text-foreground">Payment Successful!</h1>
        <p className="text-xl text-muted-foreground">
          Thank you for choosing the <span className="font-semibold text-foreground">Citadel of Excellence</span>
        </p>
        <Button onClick={() => navigate("/")} variant="outline" size="lg">
          Back to Home
        </Button>
      </div>
    </div>
  );
}
