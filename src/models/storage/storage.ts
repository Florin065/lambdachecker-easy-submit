import * as vscode from "vscode";

/**
 * A storage utility. It can handle a subset of pairs stored
 * in vscode context global state.
 */
export class Storage {
  private static context: vscode.ExtensionContext;
  private keys: Set<string>;
  private secretKeys: Set<string>;

  constructor() {
    this.keys = new Set<string>();
    this.secretKeys = new Set<string>();
  }

  /**
   * Set the context for the storage utility.
   *
   * @param context A vscode.ExtensionContext object
   */
  static setContext(context: vscode.ExtensionContext) {
    Storage.context = context;
  }

  async putSecret(key: string, value: string | undefined) {
    if (value === undefined) {
      this.secretKeys.delete(key);
      return Storage.context.secrets.delete(key);
    }

    this.secretKeys.add(key);
    return Storage.context.secrets.store(key, value);
  }

  async getSecret(key: string): Promise<string | undefined> {
    this.secretKeys.add(key);
    return Storage.context.secrets.get(key);
  }

  /**
   * Store a key-value pair in a persistent storage
   * provided by VsCode's context.globalState object.
   *
   * *Note* that using `undefined` as value removes the key
   * from the underlying storage.
   *
   * @param key A string
   * @param value A string or undefined
   */
  async put(key: string, value: string | undefined) {
    if (value === undefined) {
      this.keys.delete(key);
    } else {
      this.keys.add(key);
    }

    return Storage.context.globalState.update(key, value);
  }

  /**
   * Return the value associated with the received key.
   * If the value is not found in the current set of keys,
   * but the search is allowed to be extended to the previous
   * session, then the value is restored from the global state.
   *
   * @param key A string
   * @returns The stored value or undefined
   */
  get(
    key: string,
    restoreFromPrevSession: boolean = false
  ): string | undefined {
    if (this.keys.has(key)) {
      return Storage.context.globalState.get(key);
    } else if (restoreFromPrevSession) {
      const value: string | undefined = Storage.context.globalState.get(key);

      if (value !== undefined) {
        this.keys.add(key);
        return value;
      }
    }

    return undefined;
  }

  /**
   * Remove all stored key-value pairs from global state.
   */
  async clear() {
    for (const key of this.keys) {
      Storage.context.globalState.update(key, undefined);
    }

    for (const secretKey of this.secretKeys) {
      Storage.context.secrets.delete(secretKey);
    }

    this.keys.clear();
    this.secretKeys.clear();
  }
}
