import * as Promise from "bluebird";
import * as fs from "fs";
import { CodeEdit } from "../protocol/types";
import { Response } from "../Response";
import log from "../log";

const readFilePromise = Promise.promisify(fs.readFile);
const writeFilePromise = Promise.promisify<void, string, string>(fs.writeFile);

export function writeOutput<T>(stream: NodeJS.WritableStream, response: Response<T>) {
    let output = JSON.stringify(response);
    let outputLength = output.length;

    log(output);

    stream.write("Content-Length: " + outputLength + "\n\n");
    stream.write(output + "\n");

    return Promise.resolve<void>(null!);
}

export function writeOutputToStdOut<T>(response: Response<T>) {
    return writeOutput(process.stdout, response);
}

/** Line x (0-indexed) starts at character return[x] */
function getLineStartIndex(file: string): number[] {
    let index = -1 ;
    const indices: number[] = [0];

    // tslint:disable-next-line
    while ((index = file.indexOf("\n", index + 1)) >= 0) {
        indices.push(index + 1); /* + 1 to account for the \n */
    }

    return indices;
}

export function applyCodeEditsInMemory(fileContents: string, sortedCodeEdits: CodeEdit[]): string {
    let result = fileContents;
    const lineIndex = getLineStartIndex(result);

    sortedCodeEdits.slice().reverse().forEach(edit => {
        const startPos = lineIndex[edit.start.line - 1] + edit.start.offset - 1;
        const endPos = lineIndex[edit.end.line - 1] + edit.end.offset - 1;

        const firstSegment = result.slice(0, startPos);
        const secondSegment = result.slice(endPos);

        result = firstSegment + (edit.newText || "") + secondSegment;
    });

    return result;
}

/* Assumes codeEdits are sorted end-to-start of file. */
export function applyCodeEdits(path: string, sortedCodeEdits: CodeEdit[]): Promise<void> {
    return readFilePromise(path).then(buffer => {
        return writeFilePromise(path, applyCodeEditsInMemory(buffer.toString(), sortedCodeEdits));
    });
}
