declare interface Options {
  baseFolder: string;
  cache: boolean;
  cacheTTL: number;
  failOnMissing: boolean;
  loader: any; //fn
}
type CB = (err : any, fullSchema : Object) => void;
declare function callbackFn (err : any, fullSchema : Object) : any;
declare function deref (schema : any, options?: Options | CB, callbackFn? : CB) : any;

declare namespace jsonSchemaDeref {
  export function getRefPathValue (): any;
}

export = deref;
