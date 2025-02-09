validateNpmVersion();

var https = require('https');
var http = require('http');
var url = require('url');
var fs = require('fs');
var packageJson = require('./package.json');
var fileName = getFileName();
var filePath = "bin/" + fileName;
var version = packageJson.version;
var pkgName = "jfrog-cli-" + getArchitecture();

downloadCli();

function validateNpmVersion() {
    if (!isValidNpmVersion()) {
        throw new Error("JFrog CLI can be installed using npm version 5.0.0 or above.");
    }
}

function downloadWithProxy(myUrl) {
    var proxyparts = url.parse(process.env.https_proxy);
    var myUrlParts = url.parse(myUrl);

    http.request({
        host: proxyparts.hostname,
        port: proxyparts.port,
        method: 'CONNECT',
        path: myUrlParts.hostname + ':443'
    }).on('connect', function(res, socket, head) {
        https.get({
            host: myUrlParts.hostname,
            socket: socket,
            path: myUrlParts.path,
            agent: false
        }, function(res) {
            if (res.statusCode == 301 || res.statusCode == 302) {
                downloadWithProxy(res.headers.location);
            } else if (res.statusCode == 200) {
                writeToFile(res);
            } else {
                console.log('Unexpected status code ' + res.statusCode + ' during JFrog CLI download');
            }
        }).on('error', function (err) {console.error(err);});
    }).end();
}

function download(url) {
    https.get(url, function(res) {
        if (res.statusCode == 301 || res.statusCode == 302) {
            download(res.headers.location);
        } else if (res.statusCode == 200) {
            writeToFile(res);
        } else {
            console.log('Unexpected status code ' + res.statusCode + ' during JFrog CLI download');
        }
    }).on('error', function (err) {console.error(err);});
}

function downloadCli() {
    console.log("Downloading JFrog CLI " + version );
    var startUrl = 'https://releases.jfrog.io/artifactory/jfrog-cli/v2-jf/' + version + '/' + pkgName + '/' + fileName;
    // We detect outbound proxy by looking at the environment variable
    if (process.env.https_proxy && process.env.https_proxy.length > 0) {
        downloadWithProxy(startUrl);
    } else {
        download(startUrl);
    }
}

function isValidNpmVersion() {
    var child_process = require('child_process');
    var npmVersionCmdOut = child_process.execSync("npm version -json");
    var npmVersion = JSON.parse(npmVersionCmdOut).npm;
    // Supported since version 5.0.0
    return parseInt(npmVersion.charAt(0)) > 4;
}

function writeToFile(response) {
    var file = fs.createWriteStream(filePath);
    response.on('data', function (chunk) {
        file.write(chunk);
    }).on('end', function () {
        file.end();
        if (!process.platform.startsWith("win")) {
            fs.chmodSync(filePath, 0555);
        }
    }).on('error', function (err) {
        console.error(err);
    });
}

function getArchitecture() {
    const platform = process.platform;
    if (platform.startsWith('win')) {
        // Windows architecture:
        return 'windows-amd64';
    }
    const arch = process.arch;
    if (platform.includes('darwin')) {
        // macOS architecture:
        return arch === 'arm64' ? 'mac-arm64' : 'mac-386';
    }

    // linux architecture:
    switch (arch) {
        case 'x64':
            return 'linux-amd64';
        case 'arm64':
            return 'linux-arm64';
        case 'arm':
            return 'linux-arm';
        case 's390x':
            return 'linux-s390x';
        case 'ppc64':
            return 'linux-ppc64';
        default:
            return 'linux-386';
    }
}

function getFileName() {
    var executable = "jf";
    if (process.platform.startsWith("win")) {
        executable += ".exe";
    }
    return executable;
}
