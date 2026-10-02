// Online play server. Leave empty to connect players directly (WebRTC), which
// many school and office networks block. Set it to your relay server (see
// server/README.md) so players connect through it instead and online play
// works on those networks too. Example:
//   window.BitOnlineServer = "wss://bitplanes-relay.onrender.com";
// Adding ?server=wss://... to the page URL overrides this; ?server=off uses
// direct connections.
window.BitOnlineServer = "";
