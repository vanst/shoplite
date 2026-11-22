import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MaskedRecipientCard } from "./masked-recipient-card";

describe("<MaskedRecipientCard />", () => {
  it("hiện đủ bốn dòng, che aria-hidden và đọc bằng sr-only", () => {
    render(
      <MaskedRecipientCard
        recipient={{ name: "Test", phone: "•••••• 5678", email: "m•••@gmail.com", area: "TP.HCM" }}
      />,
    );
    const card = screen.getByTestId("masked-recipient");
    for (const label of ["Người nhận", "Số điện thoại", "Email", "Khu vực"]) {
      expect(card).toHaveTextContent(label);
    }
    expect(screen.getByText("•••••• 5678")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("kết thúc bằng 5678")).toHaveClass("sr-only");
    expect(screen.getByText("m•••@gmail.com")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("bắt đầu bằng m, tên miền gmail.com")).toHaveClass("sr-only");
  });

  it("bỏ dòng Email và Khu vực khi thiếu", () => {
    render(<MaskedRecipientCard recipient={{ name: "Test", phone: "•••••• 5678" }} />);
    expect(screen.queryByText("Email")).toBeNull();
    expect(screen.queryByText("Khu vực")).toBeNull();
  });
});
