/* eslint-disable @typescript-eslint/no-unused-vars */

const API_URL = "https://mps-tracker.vercel.app/api/transactions";
const PROCESSED_LABEL = "mps-tracker-sent";

function sendMpsTransferEmailsToApi() {
  const label =
    GmailApp.getUserLabelByName(PROCESSED_LABEL) ||
    GmailApp.createLabel(PROCESSED_LABEL);
  const query =
    'from:no-reply@mps.it subject:"Bonifico istantaneo" newer_than:30d -label:' +
    PROCESSED_LABEL;
  const threads = GmailApp.search(query, 0, 10);

  threads.forEach((thread) => {
    const messages = thread.getMessages();
    let sent = false;

    messages.forEach((message) => {
      const payload = {
        source: "email",
        emailSubject: message.getSubject(),
        emailBody: message.getPlainBody(),
        emailDate: message.getDate().toISOString(),
        emailFrom: message.getFrom(),
      };

      const response = UrlFetchApp.fetch(API_URL, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      });

      if (response.getResponseCode() >= 200 && response.getResponseCode() < 300) {
        sent = true;
      }
    });

    if (sent) {
      thread.addLabel(label);
    }
  });
}
