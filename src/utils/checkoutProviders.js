// How each connected payment provider opens its payment window in the browser.
//
// No provider is connected yet, so this list is empty on purpose. When one is, it adds ONE entry here, keyed by
// the provider's name (the same name the server reports in /payments/config and puts on every checkout):
//
//   launchers.<name> = ({ payment, checkout, finished, dismissed }) => { ...open the provider's widget... }
//
//   * `checkout.client` holds the public values the server's adapter chose to hand the browser (an order id, a
//     public key). Never a secret.
//   * call `finished()` when the widget says the person has paid, and `dismissed()` if they closed it. Neither
//     decides anything: the payment only becomes real when the provider's signed message reaches the server,
//     and the dialog keeps asking the server until it has.
//   * the widget's script must also be allowed by the Content-Security-Policy headers in vercel.json.
//
// The offline test provider needs no entry: the dialog shows its own test screen for it.
export const launchers = {};

export const canLaunch = (provider) => provider === 'sandbox' || typeof launchers[provider] === 'function';
