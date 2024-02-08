/*global QUnit*/

sap.ui.define([
	"rfscanner/pharmascience/controller/scanner.controller"
], function (Controller) {
	"use strict";

	QUnit.module("scanner Controller");

	QUnit.test("I should test the scanner controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});
