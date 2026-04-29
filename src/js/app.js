//import "../css/style.css"

const Web3 = require('web3');
const contract = require('@truffle/contract');

const DEFAULT_RPC_URL = "http://127.0.0.1:7545";
const LOCAL_CHAIN_ID_HEX = "0x539"; // 1337

const votingArtifacts = require('../../build/contracts/Voting.json');
var VotingContract = contract(votingArtifacts)


window.App = {
  getMode: function () {
    try {
      const params = new URLSearchParams(window.location.search);
      const mode = (params.get("mode") || "sim").toLowerCase();
      return mode === "chain" ? "chain" : "sim";
    } catch {
      return "sim";
    }
  },

  isChainMode: function () {
    return App.getMode() === "chain";
  },

  getAccountIndex: function () {
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get("account");
      const idx = raw === null ? 0 : Number.parseInt(raw, 10);
      return Number.isFinite(idx) && idx >= 0 ? idx : 0;
    } catch {
      return 0;
    }
  },

  connect: async function () {
    // Route the connect button to the right behavior.
    if (App.isChainMode()) {
      return App.connectChain();
    }
    return App.connectWalletOnly();
  },

  connectWalletOnly: async function () {
    if (!window.ethereum) {
      if (document.getElementById("simHint")) {
        document.getElementById("simHint").textContent =
          "No wallet detected. Simulation still works; install MetaMask to see the wallet popup.";
      }
      return null;
    }

    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const activeAccount = accounts && accounts.length ? accounts[0] : null;
      App.account = activeAccount;
      if (document.getElementById("accountAddress")) {
        $("#accountAddress").html(activeAccount ? "Your Account: " + activeAccount : "");
      }
      if (document.getElementById("simHint")) {
        document.getElementById("simHint").textContent =
          activeAccount ? "Wallet connected (simulation only)." : "Wallet connected.";
      }
      return activeAccount;
    } catch (err) {
      if (err && err.code === -32002) {
        alert("MetaMask request already pending. Open MetaMask and approve it.");
        return null;
      }
      console.error(err);
      alert("Failed to connect wallet.");
      return null;
    }
  },

  connectChain: async function () {
    const hasInjectedProvider = !!window.ethereum;
    const provider = hasInjectedProvider
      ? window.ethereum
      : new Web3.providers.HttpProvider(DEFAULT_RPC_URL);

    // Keep a Web3 instance around for account discovery.
    window.eth = new Web3(provider);

    let accounts;

    if (hasInjectedProvider) {
      // Ensure MetaMask is on the same chain the contract was deployed to.
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: LOCAL_CHAIN_ID_HEX }],
        });
      } catch (err) {
        // 4902 = unknown chain, so add it.
        if (err && err.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: LOCAL_CHAIN_ID_HEX,
                chainName: "Ganache Local",
                rpcUrls: [DEFAULT_RPC_URL],
                nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
              },
            ],
          });
        }
      }

      try {
        // This is more likely to trigger the MetaMask popup than a background request.
        await window.ethereum.request({
          method: "wallet_requestPermissions",
          params: [{ eth_accounts: {} }],
        });
      } catch (err) {
        // If the user rejects, we still let them retry by clicking again.
        console.warn("Wallet permissions request failed:", err);
      }

      try {
        accounts = await window.ethereum.request({ method: "eth_accounts" });
        if (!accounts || !accounts.length) {
          accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        }
      } catch (err) {
        // -32002: request already pending in MetaMask
        if (err && err.code === -32002) {
          alert("MetaMask request already pending. Open MetaMask and approve it.");
          return;
        }
        console.error(err);
        alert("Failed to connect MetaMask. Check the MetaMask extension.");
        return;
      }
    } else {
      // No wallet: use Ganache's unlocked accounts directly.
      accounts = await window.eth.eth.getAccounts();
      if (!accounts || !accounts.length) {
        alert(
          `No accounts found on ${DEFAULT_RPC_URL}. Is Ganache running (npm run dev)?`
        );
        return;
      }
    }

    const accountIndex = App.getAccountIndex();
    const activeAccount = accounts && accounts.length ? accounts[Math.min(accountIndex, accounts.length - 1)] : undefined;
    if (!activeAccount) {
      alert("No account available. Create/import an account in a wallet, or run Ganache.");
      return;
    }

    VotingContract.setProvider(provider);
    VotingContract.defaults({ from: activeAccount, gas: 6654755 });

    App.account = activeAccount;
    if (document.getElementById("accountAddress")) {
      $("#accountAddress").html("Your Account: " + activeAccount);
    }

    return activeAccount;
  },

  simState: {
    candidates: [],
    hasVoted: false,
  },

  simEnsureSeed: function () {
    if (App.simState.candidates.length) return;
    App.simState.candidates = [
      { id: 1, name: "Krish", party: "Clouds", votes: 0 },
      { id: 2, name: "Akash", party: "Sigma", votes: 0 },
    ];
  },

  simSelectedCandidateId: function () {
    const selected = document.querySelector("input[name='candidate']:checked");
    if (!selected) return null;
    const id = Number.parseInt(selected.value, 10);
    return Number.isFinite(id) ? id : null;
  },

  simRenderCandidates: function () {
    App.simEnsureSeed();
    const tbody = document.getElementById("boxCandidate");
    if (!tbody) return;
    tbody.innerHTML = "";

    for (const candidate of App.simState.candidates) {
      const row = document.createElement("tr");
      row.innerHTML =
        `<td><input class="form-check-input" type="radio" name="candidate" value="${candidate.id}" id="c_${candidate.id}"> ${candidate.name}</td>` +
        `<td>${candidate.party}</td>` +
        `<td>${candidate.votes}</td>`;
      tbody.appendChild(row);
    }

    const voteButton = document.getElementById("voteButton");
    if (voteButton) {
      if (App.simState.hasVoted) {
        voteButton.disabled = true;
      }
    }
  },

  simAddCandidate: function () {
    const nameEl = document.getElementById("simName");
    const partyEl = document.getElementById("simParty");
    const hintEl = document.getElementById("simHint");

    const name = nameEl ? String(nameEl.value || "").trim() : "";
    const party = partyEl ? String(partyEl.value || "").trim() : "";

    if (!name || !party) {
      if (hintEl) hintEl.textContent = "Enter both candidate name and party.";
      return;
    }

    const nextId = App.simState.candidates.reduce((max, c) => Math.max(max, c.id), 0) + 1;
    App.simState.candidates.push({ id: nextId, name, party, votes: 0 });

    if (nameEl) nameEl.value = "";
    if (partyEl) partyEl.value = "";
    if (hintEl) hintEl.textContent = "Candidate added (simulation only).";

    App.simRenderCandidates();
  },

  simVote: function () {
    const msgEl = document.getElementById("msg");
    if (App.simState.hasVoted) {
      if (msgEl) msgEl.innerHTML = "<p>You already voted in this session.</p>";
      return;
    }

    const candidateId = App.simSelectedCandidateId();
    if (!candidateId) {
      if (msgEl) msgEl.innerHTML = "<p>Please vote for a candidate.</p>";
      return;
    }

    const candidate = App.simState.candidates.find((c) => c.id === candidateId);
    if (!candidate) {
      if (msgEl) msgEl.innerHTML = "<p>Candidate not found.</p>";
      return;
    }

    candidate.votes += 1;
    App.simState.hasVoted = true;

    const voteButton = document.getElementById("voteButton");
    if (voteButton) voteButton.disabled = true;
    if (msgEl) msgEl.innerHTML = "<p>Voted (simulation).</p>";

    App.simRenderCandidates();
  },

  simInit: function () {
    if (document.getElementById("dates")) {
      $("#dates").text("Simulation mode (local only)");
    }

    const simControls = document.getElementById("simControls");
    if (simControls) simControls.style.display = "block";

    const addBtn = document.getElementById("simAddCandidate");
    if (addBtn) {
      addBtn.addEventListener("click", App.simAddCandidate);
    }

    // Enter key to add.
    const nameEl = document.getElementById("simName");
    const partyEl = document.getElementById("simParty");
    const onKey = (e) => {
      if (e && e.key === "Enter") {
        e.preventDefault();
        App.simAddCandidate();
      }
    };
    if (nameEl) nameEl.addEventListener("keydown", onKey);
    if (partyEl) partyEl.addEventListener("keydown", onKey);

    App.simRenderCandidates();

    // Vote button stays disabled until selection.
    const voteButton = document.getElementById("voteButton");
    if (voteButton) {
      voteButton.disabled = true;
    }

    const candidateContainer = document.getElementById("candidate");
    if (candidateContainer && voteButton) {
      candidateContainer.addEventListener("change", (e) => {
        const target = e && e.target;
        if (!target || target.name !== "candidate") return;
        voteButton.disabled = App.simState.hasVoted ? true : !App.simSelectedCandidateId();
      });
    }

    // Hide any blockchain-only sections that might appear later.
    if (document.getElementById("msg")) {
      document.getElementById("msg").innerHTML = "";
    }
  },

  eventStart: async function () {
    // Backward-compat name: chain mode initializer.
    return App.eventStartChain();
  },

  eventStartChain: async function () {
    const connected = await App.connectChain();
    if (!connected) return;
    VotingContract.deployed().then(function(instance){
     instance.getCountCandidates().then(function(countCandidates){

            $(document).ready(function(){
              $('#addCandidate').click(function() {
                  var nameCandidate = $('#name').val();
                  var partyCandidate = $('#party').val();
                 instance.addCandidate(nameCandidate,partyCandidate)
                   .then(function(){
                     if (document.getElementById("Aday")) {
                       $("#Aday").text("Candidate added.");
                     }
                     window.location.reload();
                   })
                   .catch(function(err){
                     console.error("ERROR! " + err.message)
                     if (document.getElementById("Aday")) {
                       $("#Aday").text(err && err.message ? err.message : String(err));
                     }
                     alert(err && err.message ? err.message : String(err));
                   });

            });   
              $('#addDate').click(function(){             
                  var startDate = Date.parse(document.getElementById("startDate").value)/1000;

                  var endDate =  Date.parse(document.getElementById("endDate").value)/1000;
           
                  instance.setDates(startDate,endDate)
                    .then(function(){
                      console.log("dates set");
                      window.location.reload();
                    })
                    .catch(function(err){
                      console.error("ERROR! " + err.message)
                      if (document.getElementById("Aday")) {
                        $("#Aday").text(err && err.message ? err.message : String(err));
                      }
                      alert(err && err.message ? err.message : String(err));
                    });

              });     

               instance.getDates().then(function(result){
                var startDate = new Date(result[0]*1000);
                var endDate = new Date(result[1]*1000);

                $("#dates").text( startDate.toDateString(("#DD#/#MM#/#YYYY#")) + " - " + endDate.toDateString("#DD#/#MM#/#YYYY#"));
              }).catch(function(err){ 
                console.error("ERROR! " + err.message)
              });           
          });
             
          for (var i = 0; i < countCandidates; i++ ){
            instance.getCandidate(i+1).then(function(data){
              var id = data[0];
              var name = data[1];
              var party = data[2];
              var voteCount = data[3];
              var viewCandidates = `<tr><td> <input class="form-check-input" type="radio" name="candidate" value="${id}" id=${id}>` + name + "</td><td>" + party + "</td><td>" + voteCount + "</td></tr>"
              $("#boxCandidate").append(viewCandidates)
            })
        }
        
        window.countCandidates = countCandidates 
      });

      instance.checkVote().then(function (voted) {
          console.log(voted);
          if(!voted)  {
            $("#voteButton").attr("disabled", false);

          }
      });

    }).catch(function(err){ 
      console.error("ERROR! " + err.message)
      alert(
        "Could not find the deployed contract for this network. " +
          "Make sure Ganache is running on 127.0.0.1:7545 and MetaMask is on chain 1337.\n\n" +
          (err && err.message ? err.message : err)
      );
    })
  },

  vote: function() {
    if (!App.isChainMode()) {
      return App.simVote();
    }

    var candidateID = $("input[name='candidate']:checked").val();
    if (!candidateID) {
      $("#msg").html("<p>Please vote for a candidate.</p>")
      return
    }
    VotingContract.deployed().then(function(instance){
      instance.vote(parseInt(candidateID)).then(function(result){
        $("#voteButton").attr("disabled", true);
        $("#msg").html("<p>Voted</p>");
         window.location.reload(1);
      })
    }).catch(function(err){ 
      console.error("ERROR! " + err.message)
    })
  },

  init: function () {
    const simControls = document.getElementById("simControls");
    if (simControls) simControls.style.display = "none";

    if (App.isChainMode()) {
      if (document.getElementById("dates")) {
        $("#dates").text("Blockchain mode");
      }
      return App.eventStartChain();
    }

    return App.simInit();
  }
}

window.addEventListener("load", function() {
  window.App.init()
})
