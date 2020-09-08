// Copyright (C) 2020 Vishal Patel <vishal.patel@ini.usc.edu>
'use strict';

class RtcPacs {
    static DEBUG = false;
    static adjectives = [
        'Agile', 'Brilliant', 'Candid', 'Daring', 'Eager',
        'Faithful', 'Gentle', 'Hungry', 'Ignorant', 'Jealous',
        'Kind', 'Loyal', 'Majestic', 'Noisy', 'Optimistic',
        'Proud', 'Quirky', 'Royal', 'Somber', 'Tidy',
        'Ultimate', 'Vibrant', 'Worried', 'Youthful', 'Zesty'
    ];
    static animals = [
        'Antelope', 'Beaver', 'Cheetah', 'Donkey', 'Elephant',
        'Fox', 'Gorilla', 'Hawk', 'Iguana', 'Jaguar',
        'Kangaroo', 'Leopard', 'Mongoose', 'Newt', 'Octopus',
        'Penguin', 'Quail', 'Rooster', 'Shark', 'Tiger',
        'Urchin', 'Vulture', 'Walrus', 'Yak', 'Zebra'
    ];
    static salt = 'qwnlcZsz-';
    static messageTypes = {
        viewer: 0,
        roster: 1,
        control: 2,
        image: 3,
        chat: 4
    }
    static broadcastImageDelay = 4000;
    static msPerFrame = 1000/30;
    static microphoneStates = {
        none: 0,
        unmuted: 1,
        muted: 2
    }

    static handleError(err) {
        console.log(err);
        window.alert(err);
    }

    constructor() {
        this.peer = new Peer(RtcPacs.salt +
                             RtcPacs.adjectives[Math.floor(Math.random() * RtcPacs.adjectives.length)] +
                             RtcPacs.animals[Math.floor(Math.random() * RtcPacs.animals.length)]
                             // ,
                             // {
                             //     host: '127.0.0.1',
                             //     port: 9000,
                             //     path: '/myapp'
                             // }
                         );
        this.peer.on('open', this.peerOpen);
        this.peer.on('disconnected', this.peerDisconnected.bind(this));
        this.peer.on('close', this.peerClose);
        this.peer.on('error', RtcPacs.handleError);
        this.peer.on('connection', this.peerConnection.bind(this));
        this.peer.on('call', this.peerCall.bind(this));

        this.codename = '';
        this.controlToggle = false;
        this.caseSelect = '';
        this.message = '';
        this.chatroom = [];
        this.controlCodename = '';
        this.rosterList = [];
        this.dataConnections = [];
        this.audioStreams = [];
        this.activeRoster = [this.peer.id];

        // TODO: Is there a better way to make sure papaya is fully loaded?
        this.viewerLinked = false;
        this.viewerDirty = false;
        this.viewerState = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,false];
        this.lastViewerUpdate = 0;

        this.audioStream = null;
        this.microphoneState = RtcPacs.microphoneStates.none;
        navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(function(stream) {
            this.audioStream = stream;
            this.microphoneState = RtcPacs.microphoneStates.unmuted;
        }.bind(this))
        .catch(function(err) {
            RtcPacs.handleError(err);
            RtcPacs.handleError('Microphone permission denied.  This is not going to work.  Look for an icon in the URL bar, grant mic access and reload the page.');
        });

        // Vars for testing
        this.t1 = 0;
        this.t2 = 0;
    }

    // Peer Event Listeners
    peerOpen(id) {
        RtcPacs.DEBUG && console.log(`Connected to signaling server with brokering ID: ${id}`);
    }

    peerDisconnected() {
        RtcPacs.DEBUG && console.log('Disconnected from signaling server');
        if (window.confirm('Disconnected from signaling server!  Try to reconnect?')) {
            RtcPacs.DEBUG && console.log('Reconnecting to signaling server')
            this.peer.reconnect();
        } else {
            RtcPacs.DEBUG && console.log('Giving up');
        }
    }

    peerClose() {
        RtcPacs.DEBUG && console.log('Peer destroyed');
    }

    peerConnection(dataConnection) {
        RtcPacs.DEBUG && console.log(`Received data connection from: ${dataConnection.peer}`);
        dataConnection.on('open', this.connectionOpenIncoming.bind(this));
        dataConnection.on('close', this.connectionClose.bind(this));
        dataConnection.on('data', this.connectionData.bind(this));
        dataConnection.on('error', RtcPacs.handleError);
    }

    peerCall(mediaConnection) {
        RtcPacs.DEBUG && console.log(`Received media connection from: ${mediaConnection.peer}`);
        mediaConnection.answer(this.audioStream, {sdpTransform: this.transformSdp});
        mediaConnection.on('stream', this.callStream.bind(this));
        mediaConnection.on('close', this.callClose.bind(this));
        mediaConnection.on('error', RtcPacs.handleError);
    }

    // DataConnection Event Listeners
    connectionOpenIncoming() {
        RtcPacs.DEBUG && console.log('Opened data connection');
        this.refreshRosters();
        this.broadcastRoster();
    }

    connectionOpenOutgoing() {
        RtcPacs.DEBUG && console.log('Opened data connection');
        this.refreshRosters();
    }

    connectionData(data) {
        RtcPacs.DEBUG && console.log('Received data: ', data);

        if (data[0] === RtcPacs.messageTypes.viewer) { // Viewer updates
            if (this.viewerState.some((element, index) => element !== data[1][index])) {
                this.viewerState = data[1];
                this.viewerDirty = true;
            }
        } else if (data[0] === RtcPacs.messageTypes.roster) { // Mesh building logic
            RtcPacs.DEBUG && console.log('received a roster!');
            let theirRoster = data[1];

            // Compare our roster to their roster
            // If ours has extra peers, broadcast our roster after a random delay to mitigate frantic replay
            this.activeRoster.some(ourPeer => {
                let isExtra = theirRoster.every(peer => peer !== ourPeer);
                if (isExtra) {
                    let delay = Math.random() * 5000;
                    setTimeout(this.broadcastRoster.bind(this), delay);
                    RtcPacs.DEBUG && console.log(`Broadcasting roster in ${delay} milliseconds.`)
                }
                return isExtra;
            });

            // If ours is missing peers, attempt to connect after a random delay (in case they connect to us first)
            theirRoster.forEach(theirPeer => {
                if (this.activeRoster.every(peer => peer !== theirPeer)) {
                    RtcPacs.DEBUG && console.log(theirPeer + ' is not in our list!');
                    let delay = Math.random() * 5000;
                    setTimeout(this.connectTo.bind(this), delay, theirPeer);
                    RtcPacs.DEBUG && console.log(`Connecting to ${theirPeer} in ${delay} milliseconds.`)
                }
            })
        } else if (data[0] == RtcPacs.messageTypes.chat) {
            RtcPacs.DEBUG && console.log(`Received chat message from ${data[1]}.`);
            this.saveChatMessage(data[1], data[2]);
        } else if (data[0] == RtcPacs.messageTypes.control) {
            if (data[2]) {
                RtcPacs.DEBUG && console.log(`Yielding control to: ${data[1]}`);
                this.controlToggle = false;
                this.controlCodename = data[1].slice(RtcPacs.salt.length);
            } else {
                RtcPacs.DEBUG && console.log(`${data[1]} gave up control`);
                this.controlCodename = '';
            }
        } else if (data[0] == RtcPacs.messageTypes.image) {
            RtcPacs.DEBUG && console.log('received an image switch notice');
            this.caseSelect = data[1];
        }
    }

    connectionClose() {
        RtcPacs.DEBUG && console.log('Closed data connection');
        this.refreshRosters();
    }

    // MediaConnection Event Listeners
    callClose() {
        RtcPacs.DEBUG && console.log('Closed call');
        this.refreshRosters();
    }

    callStream(stream) {
        RtcPacs.DEBUG && console.log('Adding audio stream', stream);
        let audioElement = new Audio();
        audioElement.srcObject = stream;
        audioElement.play();
        this.audioStreams.push(audioElement);
        this.refreshRosters();
    }

    // Instance methods
    connectTo(brokerId) {
        if (!this.activeRoster.includes(brokerId)) {
            let conn = this.peer.connect(brokerId);
            if (conn) {
                conn.on('data', this.connectionData.bind(this));
                conn.on('open', this.connectionOpenOutgoing.bind(this));
                conn.on('close', this.connectionClose.bind(this));
                conn.on('error', RtcPacs.handleError);
            } else {
                RtcPacs.DEBUG && console.log(`Failed to set up data connection with ${brokerId}`);
            }

            let call = this.peer.call(brokerId, this.audioStream, {sdpTransform: this.transformSdp});
            if (call) {
                call.on('stream', this.callStream.bind(this));
                call.on('close', this.callClose.bind(this));
                call.on('error', RtcPacs.handleError);
            } else {
                RtcPacs.DEBUG && console.log(`Failed to set up audio connection with ${brokerId}`);
            }
        } else {
            RtcPacs.DEBUG && console.log(`Oops, already connected to ${brokerId}`);
        }
        this.codename = '';
    }

    refreshRosters() {
        this.rosterList = [];
        this.dataConnections = [];
        Object.keys(this.peer.connections).forEach(brokerId => {
            let data = false;
            let audio = false;
            let connections = this.peer.connections[brokerId];
            connections.forEach(connection => {
                if (connection.open) {
                    if (connection.type === 'data') {
                        data = true;
                        this.dataConnections.push(connection);
                    } else if (connection.type === 'media') {
                        audio = true;
                    }
                }
            });
            this.rosterList.push({
                codename: brokerId.startsWith(RtcPacs.salt) ? brokerId.slice(RtcPacs.salt.length) : brokerId,
                data: data,
                audio: audio
            });
        });
        this.activeRoster = this.rosterList.filter(conn => conn.data || conn.audio).map(conn => RtcPacs.salt + conn.codename);
        this.activeRoster.push(this.peer.id);
        RtcPacs.DEBUG && console.log('Refreshed roster list', this.rosterList);
        RtcPacs.DEBUG && console.log('Refreshed data connections', this.dataConnections);
        RtcPacs.DEBUG && console.log('Refreshed active roster', this.activeRoster)
    }

    broadcastRoster() {
        RtcPacs.DEBUG && console.log('Broadcasting roster: ', this.activeRoster);
        this.dataConnections.forEach(conn => conn.send([RtcPacs.messageTypes.roster, this.activeRoster]));
        if (this.controlToggle) {
            this.takeControl();
        }
    }

    takeControl() {
        RtcPacs.DEBUG && console.log('Taking control of the viewer');
        this.dataConnections.forEach(conn => conn.send([RtcPacs.messageTypes.control, this.peer.id, true]));
        this.broadcastImage();
        setTimeout(() => { this.broadcastViewer(); }, RtcPacs.broadcastImageDelay);
    }

    yieldControl() {
        RtcPacs.DEBUG && console.log('Giving up control of the viewer');
        this.dataConnections.forEach(conn => conn.send([RtcPacs.messageTypes.control, this.peer.id, false]));
    }

    loadImage() {
        if (!this.viewerLinked) {
            RtcPacs.DEBUG && console.log('Starting loop...');
            papayaContainers[0].viewer.registerDrawViewerCallback(this.broadcastViewer.bind(this));
            window.requestAnimationFrame(this.updateViewer.bind(this));
            this.viewerLinked = true;
        }

        let url = this.caseSelect;
        papayaContainers[0].viewer.resetViewer();
        if (url) {
            papayaContainers[0].viewer.loadBaseImage([url], true, false, false);

            // Reset zoom/pan on new image
            papayaContainers[0].viewer.zoomFactor = 1;
            this.updateZoomTransforms();
        }
    }

    broadcastImage() {
        RtcPacs.DEBUG && console.log('Broadcasting image: ', this.caseSelect);
        this.dataConnections.forEach(conn => conn.send([RtcPacs.messageTypes.image, this.caseSelect]));
    }

    updateViewer(timestamp) {
        if (!this.controlToggle && this.viewerDirty && timestamp - this.lastViewerUpdate > RtcPacs.msPerFrame) {
            RtcPacs.DEBUG && console.log('Updating after: ', timestamp - this.lastViewerUpdate);
            papayaContainers[0].viewer.currentCoord.x = this.viewerState[0];
            papayaContainers[0].viewer.currentCoord.y = this.viewerState[1];
            papayaContainers[0].viewer.currentCoord.z = this.viewerState[2];
            papayaContainers[0].viewer.zoomFactor = this.viewerState[3];
            papayaContainers[0].viewer.zoomLocX = this.viewerState[4];
            papayaContainers[0].viewer.zoomLocY = this.viewerState[5];
            papayaContainers[0].viewer.zoomLocZ = this.viewerState[6];
            papayaContainers[0].viewer.panLocX = this.viewerState[7];
            papayaContainers[0].viewer.panLocY = this.viewerState[8];
            papayaContainers[0].viewer.panLocZ = this.viewerState[9];
            papayaContainers[0].viewer.panAmountX = this.viewerState[10];
            papayaContainers[0].viewer.panAmountY = this.viewerState[11];
            papayaContainers[0].viewer.panAmountZ = this.viewerState[12];
            if (papayaContainers[0].viewer.currentScreenVolume) {
                papayaContainers[0].viewer.currentScreenVolume.screenMin = this.viewerState[13];
                papayaContainers[0].viewer.currentScreenVolume.screenMax = this.viewerState[14];
                papayaContainers[0].viewer.currentScreenVolume.screenRatio = this.viewerState[15];
            }
            papayaContainers[0].viewer.container.preferences.showCrosshairs =  this.viewerState[16] ? "Yes" : "No";

            this.lastViewerUpdate = timestamp;
            this.viewerDirty = false;
            this.updateZoomTransforms();
            papayaContainers[0].viewer.drawViewer(true);
        }
        window.requestAnimationFrame(this.updateViewer.bind(this));
    }

    updateZoomTransforms() {
        let slices = [
            papayaContainers[0].viewer.axialSlice,
            papayaContainers[0].viewer.coronalSlice,
            papayaContainers[0].viewer.sagittalSlice
        ];

        slices.forEach(slice => {
            if (slice) {
                slice.updateZoomTransform(
                    papayaContainers[0].viewer.zoomFactor,
                    papayaContainers[0].viewer.zoomLocX,
                    papayaContainers[0].viewer.zoomLocY,
                    papayaContainers[0].viewer.panAmountX,
                    papayaContainers[0].viewer.panAmountY,
                    papayaContainers[0].viewer);
                }
        });
    }

    broadcastViewer() {
        if (this.controlToggle) {
            RtcPacs.DEBUG && console.log('broadcasting viewer state');
            this.viewerState = [
                papayaContainers[0].viewer.currentCoord.x,
                papayaContainers[0].viewer.currentCoord.y,
                papayaContainers[0].viewer.currentCoord.z,
                papayaContainers[0].viewer.zoomFactor,
                papayaContainers[0].viewer.zoomLocX,
                papayaContainers[0].viewer.zoomLocY,
                papayaContainers[0].viewer.zoomLocZ,
                papayaContainers[0].viewer.panLocX,
                papayaContainers[0].viewer.panLocY,
                papayaContainers[0].viewer.panLocZ,
                papayaContainers[0].viewer.panAmountX,
                papayaContainers[0].viewer.panAmountY,
                papayaContainers[0].viewer.panAmountZ,
                (papayaContainers[0].viewer.currentScreenVolume) ? papayaContainers[0].viewer.currentScreenVolume.screenMin : 0,
                (papayaContainers[0].viewer.currentScreenVolume) ? papayaContainers[0].viewer.currentScreenVolume.screenMax : 100,
                (papayaContainers[0].viewer.currentScreenVolume) ? papayaContainers[0].viewer.currentScreenVolume.screenRatio: 1,
                papayaContainers[0].viewer.container.preferences.showCrosshairs === "Yes"
            ];
            this.dataConnections.forEach(conn => conn.send([RtcPacs.messageTypes.viewer, this.viewerState]));
        }
    }

    saveChatMessage(author, msg) {
        // escaping handled by Vue
        this.chatroom.push({
            'author': (author.startsWith(RtcPacs.salt)) ? author.slice(RtcPacs.salt.length) : author,
            'msg': msg
        });
    }

    broadcastChatMessage() {
        RtcPacs.DEBUG && console.log('Broadcasting chat message: ', this.message);
        this.saveChatMessage(this.peer.id, this.message);
        this.dataConnections.forEach(conn => conn.send([RtcPacs.messageTypes.chat, this.peer.id, this.message]));
        this.message = '';
    }

    transformSdp(sdp) {
        // RtcPacs.DEBUG && console.log(sdp);
        // let newSdp = sdp.replace('maxplaybackrate=48000;', ''); // remove FF default
        // newSdp = newSdp.replace('useinbandfec=1', 'maxplaybackrate=16000;sprop-maxcapturerate=16000;useinbandfec=1'); // replace with new sampling rate
        // RtcPacs.DEBUG && console.log(newSdp);
        // return(newSdp);
        return(sdp);
    }

    testScrollF(ts) {
        let N = 35;
        if (this.t1 < N*10) {
                papayaContainers[0].viewer.currentCoord.z = this.t1 % N;
                papayaContainers[0].viewer.drawViewer(true);
                this.broadcastViewer();
                this.t1++;
                window.requestAnimationFrame(this.testScrollF.bind(this));
        } else {
            this.t1 = 0;
        }
    }

    testJumpF() {
        let N = 35;
        let m = 4;
        if (this.t2 < m*100) {
                papayaContainers[0].viewer.currentCoord.z = this.t2 % N;
                papayaContainers[0].viewer.drawViewer(true);
                this.broadcastViewer();
                this.t2 += m;
                window.setTimeout(this.testJumpF.bind(this), 500);
        } else {
            this.t2 = 0;
        }
    }
}

let rtcpacs = new RtcPacs();

var vm = new Vue({
    el: '#app',
    data: rtcpacs,
    computed: {
        peerCodeName: function() {
            return (this.peer.id) ? this.peer.id.slice(RtcPacs.salt.length) : 'null';
        },
        peerCodeNameStyle: function () {
            return {
                'font-weight-bold': this.controlToggle,
                'text-primary': this.controlToggle
            }
        },
        peerBadgeStyle: function() {
            return {
                'badge-success': this.peer.open,
                'badge-warning': this.peer.disconnected && !this.peer.destroyed,
                'badge-danger': this.peer.destroyed || (!this.peer.open && !this.peer.disconnected)
            }
        },
        peerBadgeText: function() {
            if (this.peer.open) {
                return 'open';
            } else if (this.peer.destroyed) {
                return 'destroyed';
            } else if (this.peer.disconnected) {
                return 'disconnected';
            } else {
                return 'error';
            }
        }
    },
    methods: {
        connect: function(event) {
            // Insensitive to case and spacing, where possible
            let matchCodename = this.codename.toLowerCase().trim();
            let matchAdjective = RtcPacs.adjectives.find(element => matchCodename.startsWith(element.toLowerCase()));
            let matchAnimal = RtcPacs.animals.find(element => matchCodename.endsWith(element.toLowerCase()));

            let brokerId = (matchAdjective && matchAnimal) ? RtcPacs.salt + matchAdjective + matchAnimal : RtcPacs.salt + this.codename;
            RtcPacs.DEBUG && console.log(`Connecting to: ${brokerId}`);
            this.$data.connectTo(brokerId);
        },
        sendChatMessage: function(event) {
            this.$data.broadcastChatMessage();
        },
        changeControl: function(event) {
            if (this.controlToggle) {
                this.controlCodename = this.peerCodeName;
                this.$data.takeControl();
            } else {
                this.$data.yieldControl();
            }
        },
        connectionCodeNameStyle: function(connection) {
            return {
                'font-weight-bold': connection.codename === this.controlCodename,
                'text-primary': connection.codename === this.controlCodename
            }
        },
        connectionBadgeStyle: function(connection, connectionType) {
            return (connection[connectionType]) ? 'badge-success' : 'badge-danger';
        },
        messageStyle: function(message) {
            return (message.author === this.peerCodeName) ? 'bg-light text-dark text-right ml-4' : 'bg-dark text-light text-left mr-4';
        },
        audioStatusToggle: function() {
            if (this.audioStream) {
                let newState = !this.audioStream.getAudioTracks()[0].enabled;
                this.audioStream.getAudioTracks()[0].enabled = newState;
                this.microphoneState = newState ? RtcPacs.microphoneStates.unmuted : RtcPacs.microphoneStates.muted;
            } else {
                this.microphoneState = RtcPacs.microphoneStates.none;
            }
        },
        testScroll: function() {
            this.$data.testScrollF();
        },
        testJump: function() {
            this.$data.testJumpF();
        }
    },
    watch: {
        caseSelect: function () {
            this.$data.loadImage();
            if (this.$data.controlToggle) {
                this.$data.broadcastImage();
                setTimeout(() => { this.$data.broadcastViewer(); }, RtcPacs.broadcastImageDelay);
            }
        },
        chatroom: function() {
            // Scroll to bottom after update
            this.$nextTick(() => { this.$refs.chatroom.scrollTop = this.$refs.chatroom.scrollHeight; });
        }
    }
});
