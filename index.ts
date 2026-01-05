import ipp from "ipp";

import { Bonjour } from "bonjour-service";
import {
  publishVirtualPrinterInLocalNetwork,
  createServerWhichActsAsAPrinter,
  findPrinters,
  sendResponseAsPrinter,
  saveJob,
} from "./lib/utils";

// global objects
const config = {
  printerName: "Raspberry Pi Printer Proxy", // anythign, change me after tests
  appPort: 632, // change me to 631 after tests
};

var instance = new Bonjour();

async function main() {
  try {
    const printers = await findPrinters();
    console.log(printers);

    // todo: when no printers found, exit app
    if (printers.length === 0) {
      console.log("No printers found, exiting...");
      instance.destroy(() => {
        process.exit(0);
      });
      return;
    }

    createServerWhichActsAsAPrinter({
      port: config.appPort,
      onCreateServer: async () => {
        publishVirtualPrinterInLocalNetwork(
          config.printerName,
          config.appPort,
          instance
        );
      },
      onDataReceived: (msg, req, res) => {
        const data = ipp.parse(msg);

        console.log("Received IPP job:", data);

        if (data.operation === "Get-Printer-Attributes") {
          sendResponseAsPrinter(res, data.id, {
            "printer-attributes-tag": {
              "printer-uri-supported": `ipp://localhost:${config.appPort}/printer`,
              "printer-name": "Node Virtual Printer",
              "printer-state": 3, // idle job srtate
              "printer-state-reasons": "none",
              "ipp-versions-supported": ["2.0"],
              "uri-authentication-supported": "none",
              "uri-security-supported": "none",
            },
          });
        } else if (data.operation === "Print-Job") {
          // data.data is the actual print data (PDF, etc.)
          console.log("Print job data length:", data.data.length);

          // todo - print it!
          saveJob(data.data, 1);

          sendResponseAsPrinter(res, data.id, {
            "job-attributes-tag": {
              "job-id": 1,
              "job-uri": `ipp://localhost:${config.appPort}/job/1`, // ofc add real job id
              "job-state": 9, // completed job state
              "job-state-reasons": "job-completed-successfully",
            },
          });
        } else {
          console.log("Unknown IPP operation:", data.operation);
        }
      },
    });
  } catch (error) {
    console.error(
      "Error publishing Bonjour service or finding printers:",
      error
    );

    instance.unpublishAll(() => {
      instance.destroy();
    });
  }
}

main().catch((err) => {
  console.error("Unhandled error in main:", err);
});
