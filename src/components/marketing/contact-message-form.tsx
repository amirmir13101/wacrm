"use client";

import { FormEvent, useState } from "react";
import { MessageCircle, Send } from "lucide-react";

const CONTACT_WHATSAPP_NUMBER = "447882756946";

type ContactFields = {
  name: string;
  email: string;
  business: string;
  subject: string;
  message: string;
};

const initialFields: ContactFields = {
  name: "",
  email: "",
  business: "",
  subject: "",
  message: "",
};

export function ContactMessageForm() {
  const [fields, setFields] = useState<ContactFields>(initialFields);

  function updateField(field: keyof ContactFields, value: string) {
    setFields((current) => ({ ...current, [field]: value }));
  }

  function submitToWhatsApp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const message = [
      "Talk Wagon contact request",
      `Name: ${fields.name || "Not provided"}`,
      `Email: ${fields.email || "Not provided"}`,
      `Business: ${fields.business || "Not provided"}`,
      `Subject: ${fields.subject || "Not provided"}`,
      "",
      fields.message || "No message provided.",
    ].join("\n");

    window.open(`https://wa.me/${CONTACT_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

  function openLiveChat() {
    window.Tawk_API?.maximize?.();
  }

  return (
    <form
      id="contact-form"
      onSubmit={submitToWhatsApp}
      className="rounded-[28px] border border-[#dce9e2] bg-white p-6 shadow-[0_18px_45px_rgba(7,19,14,0.08)]"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-bold text-[#07130e]">
          Name
          <input
            name="name"
            type="text"
            value={fields.name}
            onChange={(event) => updateField("name", event.target.value)}
            className="mt-2 h-12 w-full rounded-2xl border border-[#dce9e2] bg-[#f8fffb] px-4 text-sm text-[#07130e] outline-none focus:border-[#08bba4] focus:ring-2 focus:ring-[#08bba4]/20"
            autoComplete="name"
            required
          />
        </label>
        <label className="block text-sm font-bold text-[#07130e]">
          Email
          <input
            name="email"
            type="email"
            value={fields.email}
            onChange={(event) => updateField("email", event.target.value)}
            className="mt-2 h-12 w-full rounded-2xl border border-[#dce9e2] bg-[#f8fffb] px-4 text-sm text-[#07130e] outline-none focus:border-[#08bba4] focus:ring-2 focus:ring-[#08bba4]/20"
            autoComplete="email"
            required
          />
        </label>
        <label className="block text-sm font-bold text-[#07130e] sm:col-span-2">
          Business name
          <input
            name="business"
            type="text"
            value={fields.business}
            onChange={(event) => updateField("business", event.target.value)}
            className="mt-2 h-12 w-full rounded-2xl border border-[#dce9e2] bg-[#f8fffb] px-4 text-sm text-[#07130e] outline-none focus:border-[#08bba4] focus:ring-2 focus:ring-[#08bba4]/20"
            autoComplete="organization"
          />
        </label>
        <label className="block text-sm font-bold text-[#07130e] sm:col-span-2">
          Subject
          <input
            name="subject"
            type="text"
            value={fields.subject}
            onChange={(event) => updateField("subject", event.target.value)}
            className="mt-2 h-12 w-full rounded-2xl border border-[#dce9e2] bg-[#f8fffb] px-4 text-sm text-[#07130e] outline-none focus:border-[#08bba4] focus:ring-2 focus:ring-[#08bba4]/20"
            required
          />
        </label>
        <label className="block text-sm font-bold text-[#07130e] sm:col-span-2">
          Message
          <textarea
            name="message"
            rows={6}
            value={fields.message}
            onChange={(event) => updateField("message", event.target.value)}
            className="mt-2 w-full rounded-2xl border border-[#dce9e2] bg-[#f8fffb] px-4 py-3 text-sm text-[#07130e] outline-none focus:border-[#08bba4] focus:ring-2 focus:ring-[#08bba4]/20"
            required
          />
        </label>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#07130e] px-6 text-sm font-extrabold text-white hover:bg-[#1b372b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#07130e]"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          Send via WhatsApp
        </button>
        <button
          type="button"
          onClick={openLiveChat}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-[#07130e] bg-white px-6 text-sm font-extrabold text-[#07130e] hover:bg-[#07130e] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#07130e]"
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          Open Live Chat
        </button>
      </div>
      <p className="mt-4 text-xs leading-6 text-[#668276]">
        This form opens WhatsApp with your message details so the Talk Wagon team can receive your request without adding
        new email infrastructure or exposing private configuration.
      </p>
    </form>
  );
}
