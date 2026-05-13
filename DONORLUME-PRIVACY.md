# DonorLume — Privacy Policy

*Last Updated: May 11, 2026*

*Feed this file to Claude Code to build the /privacy page.*

---

## 1. Introduction

This Privacy Policy explains how Vibrant Causes, LLC ("Vibrant Causes," "we," "us," or "our") collects, uses, stores, and protects information when you use DonorLume ("the Service"), a donor intelligence platform available at donorlume.com.

We are committed to protecting your privacy and handling your data transparently. This policy applies to all users of the Service, including free and paid accounts.

## 2. Information We Collect

### 2.1 Account Information
When you create an account, we collect:
- Your name
- Email address
- Password (stored as a secure, one-way hash — we never store plaintext passwords)
- Organization name and mission statement
- Job title (optional)

### 2.2 Organization Data
When you use the Service, you may provide:
- Donor lists uploaded as CSV files (names, email addresses, gift dates, gift amounts, and other donor information)
- Prospect notes and pipeline data
- Outreach drafts and campaign configurations
- Organization settings and preferences

### 2.3 Usage Data
We automatically collect certain technical information when you use the Service:
- Browser type and version
- Pages visited and features used within the Service
- Date and time of access
- IP address
- Device type and operating system

### 2.4 Payment Information
If you subscribe to a Paid Plan, payment information (credit card number, billing address) is collected and processed directly by Stripe, Inc. We do not store your credit card information on our servers. We receive only a confirmation of payment status and the last four digits of your card for display purposes.

## 3. How We Use Your Information

We use the information we collect to:

- **Provide the Service:** Operate, maintain, and improve DonorLume's features, including prospect search, donor scoring, and AI outreach generation.
- **Authenticate and Secure:** Verify your identity, protect your account, and maintain the security of the Service.
- **Process Payments:** Facilitate subscription billing through Stripe.
- **Communicate:** Send account-related notifications, respond to support requests, and (with your consent) share product updates or relevant information.
- **Improve:** Analyze usage patterns to improve performance, fix issues, and develop new features. We use aggregated, anonymized data for this purpose — never individual donor records.
- **Legal Compliance:** Comply with applicable laws, regulations, and legal processes.

**We will never:**
- Sell your data or your donors' data to third parties
- Use your donor lists to contact your donors ourselves
- Share your organization's data with other DonorLume users or organizations
- Use your data for advertising or marketing to third parties

## 4. AI Processing

### 4.1 How AI Outreach Works
When you use the AI Outreach Studio, the donor information you select (name, giving history, relationship notes) is sent to Anthropic's Claude API to generate personalized email drafts. This data is transmitted securely via encrypted connection (TLS).

### 4.2 Anthropic's Data Practices
Anthropic processes the data solely to generate the requested email draft. Per Anthropic's API terms, data sent through the API is not used to train their AI models. For more information, see Anthropic's privacy policy at anthropic.com/privacy.

### 4.3 What Is Sent
Only the specific donor information needed to generate the outreach draft is sent to the AI — not your entire donor list or database. This includes: donor name, gift history summary, donor type, relationship notes, and your organization's name and mission.

## 5. Data Storage and Security

### 5.1 Where Data Is Stored
Your Data is stored in a PostgreSQL database hosted by Neon (neon.tech) on Amazon Web Services (AWS) infrastructure located in the United States. The application is hosted on Vercel's global edge network.

### 5.2 Security Measures
We implement industry-standard security measures, including:
- Encryption in transit (TLS/SSL for all connections)
- Encryption at rest for database storage
- Secure password hashing (bcrypt with cost factor 12)
- Multi-tenant data isolation (every database query is scoped to your organization)
- Regular security updates to our software dependencies
- Access controls limiting employee access to production data

### 5.3 Data Retention
- **Active Accounts:** Your Data is retained for as long as your account is active.
- **Canceled Accounts:** After cancellation, your data is preserved under free tier access. You may request full deletion at any time.
- **Deleted Data:** Upon a verified deletion request, we remove Your Data from active systems within 30 days. Backups may retain data for up to 90 additional days.

## 6. Data Sharing

We share your information only with the following third-party service providers, solely for the purpose of operating the Service:

| Provider | Purpose | Data Shared |
|----------|---------|-------------|
| Neon (neon.tech) | Database hosting | All stored application data (encrypted) |
| Vercel | Application hosting | Technical request data (IP, headers) |
| Stripe | Payment processing | Billing information (name, email, payment method) |
| Anthropic | AI email generation | Selected donor context for outreach drafts |

These providers are contractually obligated to protect your data and use it only for the purposes described.

We do not share your data with any other third parties unless:
- You explicitly request or authorize it
- We are required to do so by law, subpoena, or court order
- It is necessary to protect the rights, property, or safety of Vibrant Causes, our users, or the public

## 7. Your Rights

### 7.1 Access and Export
You may access and export Your Data at any time through the Service's built-in export features or by contacting support@donorlume.com.

### 7.2 Correction
You may update or correct your account information through your account settings at any time.

### 7.3 Deletion
You may request deletion of your account and all associated data by contacting support@donorlume.com. We will process verified deletion requests within 30 days.

### 7.4 Data Portability
Upon request, we will provide Your Data in a standard, machine-readable format (such as CSV or JSON).

### 7.5 Withdraw Consent
You may withdraw consent for optional data processing (such as marketing communications) at any time. Withdrawing consent does not affect the lawfulness of processing performed before the withdrawal.

## 8. California Privacy Rights (CCPA)

If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA):

- **Right to Know:** You may request that we disclose the categories and specific pieces of personal information we have collected about you.
- **Right to Delete:** You may request deletion of your personal information, subject to certain exceptions.
- **Right to Opt-Out:** We do not sell personal information. There is no need to opt out because we never sell your data.
- **Non-Discrimination:** We will not discriminate against you for exercising your CCPA rights.

To exercise these rights, contact support@donorlume.com.

## 9. Children's Privacy

The Service is not intended for use by children under the age of 13. We do not knowingly collect personal information from children under 13. If we learn that we have collected information from a child under 13, we will promptly delete it. If you believe a child under 13 has provided us with personal information, please contact support@donorlume.com.

## 10. Cookies and Tracking

### 10.1 Essential Cookies
We use essential cookies for authentication and session management. These cookies are necessary for the Service to function and cannot be disabled.

### 10.2 Analytics
We may use privacy-respecting analytics tools to understand how the Service is used. Analytics data is aggregated and anonymized. We do not use analytics to track individual donors in your lists.

### 10.3 No Advertising Cookies
We do not use advertising cookies or tracking pixels. We do not serve ads within the Service.

## 11. Changes to This Policy

We may update this Privacy Policy from time to time. If we make material changes, we will notify you by email or through a prominent notice within the Service at least 30 days before the changes take effect. Your continued use of the Service after the effective date constitutes acceptance of the updated policy.

## 12. Contact Us

If you have questions about this Privacy Policy or how we handle your data, please contact us:

- **Email:** support@donorlume.com
- **Company:** Vibrant Causes, LLC
- **Location:** Indiana, United States

For data deletion requests, export requests, or privacy concerns, email support@donorlume.com with the subject line "Privacy Request."
