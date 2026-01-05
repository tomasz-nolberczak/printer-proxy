import http from "http";
import ipp from "ipp";
import { Bonjour } from "bonjour-service";
import { exec } from "child_process";

export const createServerWhichActsAsAPrinter = ({
  port,
  onCreateServer,
  onDataReceived,
}: {
  port: number;
  onCreateServer: () => void;
  onDataReceived?: (
    data: any,
    req: http.IncomingMessage,
    res: http.ServerResponse<http.IncomingMessage> & {
      req: http.IncomingMessage;
    }
  ) => void;
}) => {
  const server = http.createServer((req, res) => {
    onCreateServer();

    const chunks: Uint8Array[] = [];

    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const msg = Buffer.concat(chunks);
      onDataReceived && onDataReceived(msg, req, res);
    });
  });

  server.listen(port);
  console.log(`IPP server listening on port ${port}`);
};

export const publishVirtualPrinterInLocalNetwork = (
  printerName: string,
  port: number,
  bonjourInstance: Bonjour
) => {
  bonjourInstance.publish({
    name: printerName,
    type: "ipp",
    port: port,
    txt: {
      txtvers: "1",
      qtotal: "1",
      rp: "printer",
      ty: printerName,
      adminurl: `http://localhost:${port}/admin`,
      note: "Office",
      product: "(NodePrinter)",
      "printer-state": "3",
      "printer-type": "0x809046",
      Transparent: "T",
      Binary: "T",
      Color: "T",
      Duplex: "T",
    },
  });
};

export const findPrinters = async () => {
  return new Promise<string>(function (resolve, reject) {
    exec("lpstat -v", (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(stdout.trim());
    });
  }).then((response) => {
    return response
      .split("\n")
      .filter((l) => l.includes("usb://"))
      .map((l) => {
        const [, name, uri] = l.match(/^device for (.+?): (.+)$/) || [];
        return { name, uri };
      });
  });
};

export const sendResponseAsPrinter = (
  res: http.ServerResponse,
  requestId: number,
  data: any
) => {
  res.setHeader("Content-Type", "application/ipp");
  res.end(
    ipp.serialize({
      version: "2.0",
      statusCode: "successful-ok",
      requestId: requestId,
      attributes: data,
    })
  );
};
