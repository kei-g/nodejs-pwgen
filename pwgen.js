var fs = require('fs');
var url = require('url');

var classOfChar = function (c) {
	if ('0' <= c && c <= '9')
		return 1;
	if ('A' <= c && c <= 'Z')
		return 2;
	if ('a' <= c && c <= 'z')
		return 4;
	if (c == '(' || c == ')' || c == '\\' || c == '\'' || c == '\"' ||
		c == ';' || c == ':' || c == '_' || c == '-' ||
		c == '+' || c == '*' || c == '[' || c == ']' ||
		c == '{' || c == '}' || c == '@' || c == '/' ||
		c == ',' || c == '.' || c == '<' || c == '>' ||
		c == '^' || c == '~' || c == '!' || c == '#' ||
		c == '$' || c == '%' || c == '&' || c == '|')
		return 8;
	return 0;
}

var genPassword = function (req, res, err, fd) {
	var onRead = function (err, len, buf) {
	};
	var doRead = function (buf) {
		fs.read(fd, buf, 0, 1, 0, onRead);
	};
	var doFail = function (code) {
		fs.close(fd, function (err) {
		});
		res.writeHead(code);
		res.end();
	};
	var doSend = function (str) {
		fs.close(fd, function (err) {
		});
		res.writeHead(200, { 'ContentType': 'text/plain' });
		res.end(str);
	};
	var query = new url.URL(req.url).query;
	var str = '';
	var mask = 0;
	onRead = function (err, len, buf) {
		if (err)
			return doFail(500);
		if (len < 1)
			return doRead(buf);
		var c = buf.toString('ascii');
		var cls = classOfChar(c);
		if ((cls & query.c) == 0)
			return doRead(buf);
		str = str + c;
		mask |= cls;
		if (str.length < query.l)
			return doRead(buf);
		else if ((mask & query.c) == query.c)
			return doSend(str);
		str = '';
		mask = 0;
		doRead(buf);
	};
	doRead(Buffer.alloc(1));
};

var respondHTML = function (req, res, err, fd) {
	var buf = Buffer.alloc(64 * 1024);
	fs.read(fd, buf, 0, buf.length, 0, function (err, len, buf) {
		fs.close(fd, function (err) {
		});
		res.writeHead(200, { 'Content-Type': 'text/html' });
		res.end(buf.toString('ascii', 0, len));
	});
};

var handlers = {
	'/': { 'file': './main.html', 'func': respondHTML },
	'/password': { 'file': '/dev/urandom', 'func': genPassword },
};

fs.writeFileSync('/var/run/pwgen.pid', '' + process.pid);

process.setgid(65534);
process.setuid(65534);

var http = require('http');
http.createServer(function (req, res) {
	console.log("[%s] %s %s %j", req.remoteAddress,
		req.method, req.url, req.headers);
	var doFail = function (status) {
		res.writeHead(status);
		res.end();
	};
	var path = new url.URL(req.url).pathname;
	var ctx = handlers[path];
	if (ctx)
		fs.open(ctx.file, 'r', 0400, function (err, fd) {
			if (err)
				doFail(404);
			else
				ctx.func(req, res, err, fd);
		});
	else
		doFail(403);
}).listen(3001, "127.0.0.1");
