import { parseJsonRpcErrorResponse, parseJsonRpcResponse2, parseJsonRpcSuccessResponse } from "./parse";
import { jsonRpcCode, JsonRpcErrorResponse, JsonRpcSuccessResponse } from "./types";

describe("parse", () => {
  describe("parseJsonRpcErrorResponse", () => {
    it("works for valid error", () => {
      const response: any = {
        jsonrpc: "2.0",
        id: 123,
        error: {
          code: jsonRpcCode.serverError.default,
          message: "Something bad happened",
          data: [2, 3, 4],
        },
      };
      expect(parseJsonRpcErrorResponse(response)).toEqual(response);
    });

    it("works for error with null ID", () => {
      const response: any = {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: jsonRpcCode.parseError,
          message: "Could not parse request ID",
        },
      };
      expect(parseJsonRpcErrorResponse(response)).toEqual(response);
    });

    it("works for error with null data", () => {
      const response: any = {
        jsonrpc: "2.0",
        id: 123,
        error: {
          code: jsonRpcCode.serverError.default,
          message: "Something bad happened",
          data: null,
        },
      };
      expect(parseJsonRpcErrorResponse(response)).toEqual(response);
    });

    it("works for error with unset data", () => {
      const response: any = {
        jsonrpc: "2.0",
        id: 123,
        error: {
          code: jsonRpcCode.serverError.default,
          message: "Something bad happened",
        },
      };
      expect(parseJsonRpcErrorResponse(response)).toEqual(response);
    });

    it("throws for invalid type", () => {
      const expectedError = /data must be JSON compatible dictionary/i;
      expect(() => parseJsonRpcErrorResponse(undefined)).toThrowError(expectedError);
      expect(() => parseJsonRpcErrorResponse(null)).toThrowError(expectedError);
      expect(() => parseJsonRpcErrorResponse(false)).toThrowError(expectedError);
      expect(() => parseJsonRpcErrorResponse("error")).toThrowError(expectedError);
      expect(() => parseJsonRpcErrorResponse(42)).toThrowError(expectedError);
      expect(() => parseJsonRpcErrorResponse(() => true)).toThrowError(expectedError);
      expect(() => parseJsonRpcErrorResponse({ foo: () => true })).toThrowError(expectedError);
      expect(() => parseJsonRpcErrorResponse({ foo: () => new Uint8Array([]) })).toThrowError(expectedError);
    });

    it("throws for invalid version", () => {
      // wrong type
      {
        const response: any = {
          jsonrpc: 2.0,
          id: 123,
          error: {
            code: jsonRpcCode.serverError.default,
            message: "Something bad happened",
          },
        };
        expect(() => parseJsonRpcErrorResponse(response)).toThrowError(/got unexpected jsonrpc version/i);
      }
      // wrong version
      {
        const response: any = {
          jsonrpc: "1.0",
          id: 123,
          error: {
            code: jsonRpcCode.serverError.default,
            message: "Something bad happened",
          },
        };
        expect(() => parseJsonRpcErrorResponse(response)).toThrowError(/got unexpected jsonrpc version/i);
      }
      // unset
      {
        const response: any = {
          id: 123,
          error: {
            code: jsonRpcCode.serverError.default,
            message: "Something bad happened",
          },
        };
        expect(() => parseJsonRpcErrorResponse(response)).toThrowError(/got unexpected jsonrpc version/i);
      }
    });

    it("throws for invalid ID", () => {
      // wrong type
      {
        const response: any = {
          jsonrpc: "2.0",
          id: [1, 2, 3],
          error: {
            code: jsonRpcCode.serverError.default,
            message: "Something bad happened",
          },
        };
        expect(() => parseJsonRpcErrorResponse(response)).toThrowError(/invalid id field/i);
      }
      // unset
      {
        const response: any = {
          jsonrpc: "2.0",
          error: {
            code: jsonRpcCode.serverError.default,
            message: "Something bad happened",
          },
        };
        expect(() => parseJsonRpcErrorResponse(response)).toThrowError(/invalid id field/i);
      }
    });

    it("throws for success response", () => {
      const response: JsonRpcSuccessResponse = {
        jsonrpc: "2.0",
        id: 123,
        result: 3000,
      };
      expect(() => parseJsonRpcErrorResponse(response)).toThrowError(/invalid error field/i);
    });
  });

  describe("parseJsonRpcSuccessResponse", () => {
    it("works for response with dict result", () => {
      const response: any = {
        jsonrpc: "2.0",
        id: 123,
        result: {
          foo: "bar",
        },
      };
      expect(parseJsonRpcSuccessResponse(response)).toEqual(response);
    });

    it("works for response with null result", () => {
      const response: any = {
        jsonrpc: "2.0",
        id: 123,
        result: null,
      };
      expect(parseJsonRpcSuccessResponse(response)).toEqual(response);
    });

    it("throws for invalid type", () => {
      const expectedError = /data must be JSON compatible dictionary/i;
      expect(() => parseJsonRpcSuccessResponse(undefined)).toThrowError(expectedError);
      expect(() => parseJsonRpcSuccessResponse(null)).toThrowError(expectedError);
      expect(() => parseJsonRpcSuccessResponse(false)).toThrowError(expectedError);
      expect(() => parseJsonRpcSuccessResponse("success")).toThrowError(expectedError);
      expect(() => parseJsonRpcSuccessResponse(42)).toThrowError(expectedError);
      expect(() => parseJsonRpcSuccessResponse(() => true)).toThrowError(expectedError);
      expect(() => parseJsonRpcSuccessResponse({ foo: () => true })).toThrowError(expectedError);
    });

    it("throws for invalid version", () => {
      // wrong type
      {
        const response: any = {
          jsonrpc: 2.0,
          id: 123,
          result: 3000,
        };
        expect(() => parseJsonRpcSuccessResponse(response)).toThrowError(/got unexpected jsonrpc version/i);
      }
      // wrong version
      {
        const response: any = {
          jsonrpc: "1.0",
          id: 123,
          result: 3000,
        };
        expect(() => parseJsonRpcSuccessResponse(response)).toThrowError(/got unexpected jsonrpc version/i);
      }
      // unset
      {
        const response: any = {
          id: 123,
          result: 3000,
        };
        expect(() => parseJsonRpcSuccessResponse(response)).toThrowError(/got unexpected jsonrpc version/i);
      }
    });

    it("throws for invalid ID", () => {
      // wrong type
      {
        const response: any = {
          jsonrpc: "2.0",
          id: [1, 2, 3],
          result: 3000,
        };
        expect(() => parseJsonRpcSuccessResponse(response)).toThrowError(/invalid id field/i);
      }
      // wrong type
      {
        const response: any = {
          jsonrpc: "2.0",
          id: null,
          result: 3000,
        };
        expect(() => parseJsonRpcSuccessResponse(response)).toThrowError(/invalid id field/i);
      }
      // unset
      {
        const response: any = {
          jsonrpc: "2.0",
          result: 3000,
        };
        expect(() => parseJsonRpcSuccessResponse(response)).toThrowError(/invalid id field/i);
      }
    });

    it("throws for error response", () => {
      const response: JsonRpcErrorResponse = {
        jsonrpc: "2.0",
        id: 123,
        error: {
          code: jsonRpcCode.parseError,
          message: "Could not parse request ID",
        },
      };
      expect(() => parseJsonRpcSuccessResponse(response)).toThrowError(/invalid result field/i);
    });
  });

  describe("parseJsonRpcResponse2", () => {
    it("works for success response", () => {
      const response: any = {
        jsonrpc: "2.0",
        id: 123,
        result: 3000,
      };
      expect(parseJsonRpcResponse2(response)).toEqual(response);
    });

    it("works for error response", () => {
      const response: any = {
        jsonrpc: "2.0",
        id: 123,
        error: {
          code: jsonRpcCode.serverError.default,
          message: "Something bad happened",
          data: [2, 3, 4],
        },
      };
      expect(parseJsonRpcResponse2(response)).toEqual(response);
    });

    it("favours error if response is error and success at the same time", () => {
      const response: any = {
        jsonrpc: "2.0",
        id: 123,
        result: 3000,
        error: {
          code: jsonRpcCode.serverError.default,
          message: "Something bad happened",
        },
      };
      expect(parseJsonRpcResponse2(response)).toEqual({
        jsonrpc: "2.0",
        id: 123,
        error: {
          code: jsonRpcCode.serverError.default,
          message: "Something bad happened",
        },
      });
    });

    it("throws for invalid type", () => {
      const expectedError = /data must be JSON compatible dictionary/i;
      expect(() => parseJsonRpcResponse2(undefined)).toThrowError(expectedError);
      expect(() => parseJsonRpcResponse2(null)).toThrowError(expectedError);
      expect(() => parseJsonRpcResponse2(false)).toThrowError(expectedError);
      expect(() => parseJsonRpcResponse2("error")).toThrowError(expectedError);
      expect(() => parseJsonRpcResponse2(42)).toThrowError(expectedError);
      expect(() => parseJsonRpcResponse2(() => true)).toThrowError(expectedError);
      expect(() => parseJsonRpcResponse2({ foo: () => true })).toThrowError(expectedError);
      expect(() => parseJsonRpcResponse2({ foo: () => new Uint8Array([]) })).toThrowError(expectedError);
    });

    it("throws for invalid version", () => {
      const expectedError = /got unexpected jsonrpc version/i;
      // wrong type
      {
        const response: any = {
          jsonrpc: 2.0,
          id: 123,
          result: 3000,
        };
        expect(() => parseJsonRpcResponse2(response)).toThrowError(expectedError);
      }
      // wrong version
      {
        const response: any = {
          jsonrpc: "1.0",
          id: 123,
          result: 3000,
        };
        expect(() => parseJsonRpcResponse2(response)).toThrowError(expectedError);
      }
      // unset
      {
        const response: any = {
          id: 123,
          result: 3000,
        };
        expect(() => parseJsonRpcResponse2(response)).toThrowError(expectedError);
      }
    });
  });
});