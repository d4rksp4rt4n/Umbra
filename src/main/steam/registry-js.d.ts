/**
 * `registry-js` only ships prebuilt binaries for win32 and is listed as an
 * optionalDependency for that reason — on Linux/macOS dev machines (and this
 * repo's CI) `npm install` skips it entirely. This ambient declaration covers
 * just the surface `src/main/steam/discovery.ts` uses via dynamic `import()`,
 * so typechecking succeeds everywhere even when the package isn't installed.
 */
declare module 'registry-js' {
  export enum HKEY {
    HKEY_CLASSES_ROOT = 0,
    HKEY_CURRENT_USER = 1,
    HKEY_LOCAL_MACHINE = 2,
    HKEY_USERS = 3,
    HKEY_CURRENT_CONFIG = 4
  }

  export enum RegistryValueType {
    REG_NONE = 'REG_NONE',
    REG_SZ = 'REG_SZ',
    REG_EXPAND_SZ = 'REG_EXPAND_SZ',
    REG_BINARY = 'REG_BINARY',
    REG_DWORD = 'REG_DWORD',
    REG_DWORD_LITTLE_ENDIAN = 'REG_DWORD_LITTLE_ENDIAN',
    REG_DWORD_BIG_ENDIAN = 'REG_DWORD_BIG_ENDIAN',
    REG_LINK = 'REG_LINK',
    REG_MULTI_SZ = 'REG_MULTI_SZ',
    REG_QWORD = 'REG_QWORD',
    REG_QWORD_LITTLE_ENDIAN = 'REG_QWORD_LITTLE_ENDIAN'
  }

  export interface RegistryValue {
    name: string
    type: RegistryValueType
    data: string | number | Buffer | string[] | null
  }

  export function enumerateValues(hive: HKEY, key: string): RegistryValue[]
  export function enumerateKeys(hive: HKEY, key: string): string[]
}
