sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/base/Log",
    "sap/m/MessageBox"
], function (Controller, JSONModel, Log, MessageBox) {
        "use strict";

        return Controller.extend("rfscanner.pharmascience.controller.scanner", {
            onInit: async function () {
                var sUrl = "/sap/opu/odata/sap/ZIW41_SRV";
                this._oDataModel = new sap.ui.model.odata.ODataModel(sUrl, true);
                this._i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle();

                this._setInitialData();
                await this._getCurrentUserInfo();
            },

            onWorkOrderChange: function(oEvent){
                let oParams = oEvent.getParameters(),
                    sWoNumber = oParams.value;
                
                sWoNumber !== "" ? this._getWorkOrder(sWoNumber) : this._setInitialData();
            },

            onWorkOrderScanSuccess: function(oEvent) {
                let oParams = oEvent.getParameters(),
                    sWoNumber = oParams.text;

                sWoNumber !== "" ? this._getWorkOrder(sWoNumber) : this._setInitialData();
                
                // this._oWorkOrderModel.setData(oMockData);
                if (oEvent.getParameter("cancelled")) {
                    this._oWorkOrderModel.setData({});
                    MessageToast.show("Scan cancelled", { duration:1000 });
                }
            },

            onWorkOrderScanError: function(oEvent) {
                MessageToast.show("Scan failed: " + oEvent, { duration:1000 });
            },

            onMaterialChange: function(oEvent){
                let oParams = oEvent.getParameters(),
                    sMaterial = oParams.value;
                
                if (sMaterial !== "") 
                    this._getMaterial(sMaterial);
            },

            onMaterialScanSuccess: function(oEvent) {
                let oParams = oEvent.getParameters(),
                    sMaterial = oParams.text;

               
                if (sMaterial !== "") 
                    this._getMaterial(sMaterial);

				if (oEvent.getParameter("cancelled")) {
					this._oWorkOrderModel.setData({});
					MessageToast.show("Scan cancelled", { duration:1000 });
				}
			},

			onMaterialScanError: function(oEvent) {
				MessageToast.show("Scan failed: " + oEvent, { duration:1000 });
			},

            onQuantityChanged: function(oEvent){
                let oParam = oEvent.getParameters(),
                    sQty = oParam.text;
                if (sQty !== "")
                    this._oWorkOrderModel.setProperty("/enableSave", true);
            },

            onSaveMaterial: function(){
                let oModelData = this._oWorkOrderModel.getData();
                let oParams = {
                    OrderID: oModelData.OrderID,
                    MaterialNumber: oModelData.MaterialNumber,
                    Quantity: oModelData.Quantity,
                    Uom: oModelData.Uom
                }
                this._oDataModel.callFunction("postnotification", // function import name
                    "POST", // http method
                    JSON.stringify(oParams), // function import parameters
                    null,        
                    function(oData, response) { 
                        this._resetToWorkOrderData();
                    }, // callback function for success
                    function(oError){

                    } 
                ); // callback function for error
            },

            _setInitialData: function(){
                 //initial setup upon opening the app
                 this._oWorkOrderModel = new JSONModel({
                    enableSave: false,
                    materialInfoVisible: false,
                    quantityInfoVisible: false,
                    inputPopulated: false,
                    woOrderFound: true
                });
                this.getView().setModel(this._oWorkOrderModel , "workOrderModel");
            },

            /**
             * This is to reset the data after a successful Material save
             */
            _showMaterialNotFound: function(oError){
                MessageBox.error(this._i18n.getText("MaterialNotFoundDescription"), {
                    title: this._i18n.getText("MaterialNotFound")
                });
                this._oWorkOrderModel.setProperty("/material", "");
            },

            _getWorkOrder: function(sWoNumber){
                return new Promise((resolve, reject) => {
                    var sPath = `/WorkOrder('${sWoNumber}')`;
                    this._oDataModel.read(sPath, {
                        success: oResult => {
                            this._oWorkOrderModel.setProperty("/workOrder", oResult.OrderID);
                            this._oWorkOrderModel.setProperty("/workOrderDescription", oResult.Text);
                            this._oWorkOrderModel.setProperty("/materialInfoVisible", true);
                            this._oWorkOrderModel.setProperty("/quantityInfoVisible", false);
                            this._oWorkOrderModel.setProperty("/enableSave", false);
                            this._oWorkOrderModel.setProperty("/woOrderFound", true);
                            resolve();
                        },
                        error: function(oError) {
                            this._setInitialData();
                            this._oWorkOrderModel.setProperty("/woOrderFound", false);
                            // MessageBox.error(this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralPassportCode.Error"));
                        }.bind(this)
                    });
                });
            },

            _getMaterial: function(sMaterialnumber){
                var sPath = `/Material('${sMaterialnumber}')`;
                this._oDataModel.read(sPath, {
                    success: oResult => {
                        this._oWorkOrderModel.setProperty("/material", oResult.MaterialNumber);
                        this._oWorkOrderModel.setProperty("/materialDescription", oResult.Text);
                        this._oWorkOrderModel.setProperty("/unitOfMeasure", oResult.Uom);
                        this._oWorkOrderModel.setProperty("/quantityInfoVisible", true);
                    },
                    error: function(oError) {
                        this._showMaterialNotFound(oError);
                        // MessageBox.error(this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralPassportCode.Error"));
                    }.bind(this)
                });
            },

            _getCurrentUserInfo: function(){
                return new Promise((resolve, reject) => {
                    this._oUserModel = new JSONModel({
                        enableSave: false,
                        materialInfoVisible: false,
                        quantityInfoVisible: false,
                        inputPopulated: false,
                        woOrderFound: true
                    });
                    this.getView().setModel(this._oUserModel , "userModel");

                    let sCurrentUser = sap.ushell.Container.getService("UserInfo").getId();
                    // this._oWorkOrderModel.setProperty("/user", sCurrentUser);
                    this._oUserModel.setProperty("/user", "JBULDA");
                    // let sPath = `/User('${sCurrentUser}')`;
                    let sPath = `/User('JBULDA')`;
                    this._oDataModel.read(sPath, {
                        success: oResult => {
                            this._oUserModel.setProperty("/userPlant", oResult.Plant);
                            this._oUserModel.setProperty("/userStorageLocation", oResult.StorageLocation);
                        },
                        error: function(oError) {
                            // MessageBox.error(this.i18nModel.getResourceBundle().getText("ErrorMessage.GeneralPassportCode.Error"));
                        }.bind(this)
                    });
                });
            }
        });
    });
