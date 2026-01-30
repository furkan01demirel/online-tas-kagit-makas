import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8080";

export default function App() {
  const wsRef = useRef(null);

  const [status, setStatus] = useState("Bağlanıyor...");
  const [clientId, setClientId] = useState(null);

  const [roomId, setRoomId] = useState("");
  const [joinedRoom, setJoinedRoom] = useState(null);

  const [playerCount, setPlayerCount] = useState(0);
  const [choicesCount, setChoicesCount] = useState(0);

  const [myChoice, setMyChoice] = useState(null);
  const [lastResult, setLastResult] = useState(null);

  const canPlay = joinedRoom && playerCount === 2;

  const send = (type, payload = {}) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type, payload }));
  };

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => setStatus("Bağlandı ✅");
    ws.onclose = () => setStatus("Bağlantı kapandı ❌");
    ws.onerror = () => setStatus("Bağlantı hatası ❌");

    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      const { type, payload } = msg;

      if (type === "WELCOME") setClientId(payload.clientId);

      if (type === "ROOM_CREATED") setRoomId(payload.roomId);

      if (type === "JOINED") {
        setJoinedRoom(payload.roomId);
        setLastResult(null);
        setMyChoice(null);
        setChoicesCount(0);
      }

      if (type === "LEFT") {
        setJoinedRoom(null);
        setPlayerCount(0);
        setChoicesCount(0);
        setMyChoice(null);
        setLastResult(null);
      }

      if (type === "ROOM_FULL") alert("Oda dolu (2 kişi).");

      if (type === "ROOM_UPDATE") {
        setPlayerCount(payload.playerCount);
        setChoicesCount(payload.choicesCount);
      }

      if (type === "CHOICE_RECEIVED") setChoicesCount(payload.choicesCount);

      if (type === "READY") {
        // İstersen UI mesajı gösterebilirsin
        // console.log(payload.message);
      }

      if (type === "OPPONENT_LEFT") {
        setChoicesCount(0);
        setMyChoice(null);
        alert(payload.message);
      }

      if (type === "ROUND_RESULT") {
        setLastResult(payload);
        setMyChoice(null);
        setChoicesCount(0);
      }

      if (type === "ERROR") console.warn(payload?.message);
    };

    return () => ws.close();
  }, []);

  const outcomeText = useMemo(() => {
    if (!lastResult || !clientId) return null;
    const { winnerId, draw, choices } = lastResult;

    const my = choices?.[clientId];
    const oppId = Object.keys(choices || {}).find((id) => id !== clientId);
    const opp = oppId ? choices[oppId] : null;

    if (draw) return `Berabere! (Sen: ${label(my)} | Rakip: ${label(opp)})`;
    if (winnerId === clientId) return `Kazandın! 🎉 (Sen: ${label(my)} | Rakip: ${label(opp)})`;
    return `Kaybettin 😅 (Sen: ${label(my)} | Rakip: ${label(opp)})`;
  }, [lastResult, clientId]);

  return (
  <div className="page">
    <div className="shell">
      <div className="topbar">
        <div className="brand">
          <div className="logo" />
          <h1>Online Taş-Kağıt-Makas</h1>
        </div>
        <div className="badge">
          {status} {clientId ? `• ID: ${clientId}` : ""}
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <div className="sectionTitle">Oda İşlemleri</div>

          <div className="row">
            <button className="btn btnPrimary" onClick={() => send("CREATE_ROOM")}>
              Oda Oluştur
            </button>

            <input
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Oda ID"
            />

            <button className="btn" onClick={() => send("JOIN_ROOM", { roomId })}>
              Odaya Katıl
            </button>

            {joinedRoom && (
              <button className="btn btnGhost" onClick={() => send("LEAVE_ROOM")}>
                Odadan Çık
              </button>
            )}
          </div>

          <div className="kv">
            <div className="kvItem">
              <b>Oda</b>
              <span>{joinedRoom || "-"}</span>
            </div>
            <div className="kvItem">
              <b>Oyuncu</b>
              <span>{playerCount}/2</span>
            </div>
            <div className="kvItem">
              <b>Seçimler</b>
              <span>{choicesCount}/2</span>
            </div>
          </div>

          <div className="divider" />

          <div className="sectionTitle">Seçimini Yap</div>
          {!canPlay && <div className="muted">Oynamak için odada 2 kişi olmalı.</div>}

          <div className="choices">
            <button
              className={`choice choiceRock ${myChoice === "rock" ? "active" : ""}`}
              disabled={!canPlay || !!myChoice}
              onClick={() => { setMyChoice("rock"); send("PLAY", { choice: "rock" }); }}
            >
              🪨 Taş
            </button>

            <button
              className={`choice choicePaper ${myChoice === "paper" ? "active" : ""}`}
              disabled={!canPlay || !!myChoice}
              onClick={() => { setMyChoice("paper"); send("PLAY", { choice: "paper" }); }}
            >
              📄 Kağıt
            </button>

            <button
              className={`choice choiceScissors ${myChoice === "scissors" ? "active" : ""}`}
              disabled={!canPlay || !!myChoice}
              onClick={() => { setMyChoice("scissors"); send("PLAY", { choice: "scissors" }); }}
            >
              ✂️ Makas
            </button>
          </div>

          {(myChoice || outcomeText) && (
            <div
              className={[
                "resultBox",
                outcomeText?.includes("Kazandın") ? "resultWin" : "",
                outcomeText?.includes("Kaybettin") ? "resultLose" : "",
                outcomeText?.includes("Berabere") ? "resultDraw" : "",
              ].join(" ")}
            >
              {myChoice && <div className="small">Seçim gönderildi: <b>{label(myChoice)}</b> (bekleniyor…)</div>}
              {outcomeText && <div style={{ fontWeight: 800 }}>{outcomeText}</div>}
            </div>
          )}
        </div>

        <div className="side">
          <div className="tip">
            <div className="sectionTitle">Nasıl Oynanır?</div>
            <div className="small">
              1) Oda oluştur ve ID’yi kopyala.<br/>
              2) Diğer sekmede aynı ID ile odaya katıl.<br/>
              3) İkiniz de seçim yapınca sonuç gelir.<br/><br/>
              İpucu: 2 sekme = 2 oyuncu 🎮
            </div>
          </div>

          <div className="tip">
            <div className="sectionTitle">Durum</div>
            <div className="small">
              {joinedRoom
                ? (playerCount === 2 ? "Rakip hazır. Seçimini yap!" : "Rakip bekleniyor…")
                : "Bir odaya katıl veya oda oluştur."}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);
}

function label(choice) {
  if (choice === "rock") return "Taş";
  if (choice === "paper") return "Kağıt";
  if (choice === "scissors") return "Makas";
  return "-";
}
