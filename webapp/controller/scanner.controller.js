sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/base/Log",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Controller, JSONModel, Log, MessageBox, Filter, FilterOperator) {
        "use strict";

        return Controller.extend("rfscanner.pharmascience.controller.scanner", {
            onInit: async function () {
                this._oDataModel = this.getOwnerComponent().getModel();
                this._i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle();

                this._setInitialData();
                await this._getCurrentUserInfo();
            },

            onWorkOrderChange: function(oEvent){
                let oParams   = oEvent.getParameters(),
                    sWoNumber = oParams.value;
                
                sWoNumber !== "" ? this._getWorkOrder(sWoNumber) : this._setInitialData();
            },

            onWorkOrderScanSuccess: function(oEvent) {
                let oParams   = oEvent.getParameters(),
                    sWoNumber = oParams.text;

                sWoNumber !== "" ? this._getWorkOrder(sWoNumber) : this._setInitialData();
                
                if (oEvent.getParameter("cancelled")) {
                    this._oWorkOrderModel.setData({});
                    MessageToast.show(this._i18n.getText("ScanCancelled") + ": ", { duration:1000 });
                }
            },

            onWorkOrderScanError: function(oEvent) {
                MessageToast.show(this._i18n.getText("ScanFailed") + ": " + oEvent, { duration:1000 });
            },

            onMaterialChange: function(oEvent){
                let oParams   = oEvent.getParameters(),
                    sMaterial = oParams.value;
                
                if (sMaterial !== "") 
                    this._getMaterial(sMaterial);
            },

            onMaterialScanSuccess: function(oEvent) {
                let oParams   = oEvent.getParameters(),
                    sMaterial = oParams.text;

               
                if (sMaterial !== "") 
                    this._getMaterial(sMaterial);

				if (oEvent.getParameter("cancelled")) {
					this._oWorkOrderModel.setData({});
					MessageToast.show(this._i18n.getText("ScanCancelled") + ": ", { duration:1000 });
				}
			},

			onMaterialScanError: function(oEvent) {
				MessageToast.show(this._i18n.getText("ScanFailed") + ": " + oEvent, { duration:1000 });
			},

            onQuantityChanged: function(oEvent){
                let oParam = oEvent.getParameters(),
                    sQty   = oParam.value,
                    dQuantityInStock = this._oWorkOrderModel.getProperty("/quantityInStock");

                if (sQty !== "")
                    this._oWorkOrderModel.setProperty("/enableSave", true);
                if (parseFloat(sQty) > dQuantityInStock){
                    oEvent.getSource().setValueState("Error");
                    oEvent.getSource().setValueStateText(this._i18n.getText("CannotBeHigherThanStockQuantity", [dQuantityInStock]));
                    this._oWorkOrderModel.setProperty("/enableSave", false);
                } else {
                    oEvent.getSource().setValueState("None");
                } 
            },

            onSaveMaterial: function(){
                let oModelData = this._oWorkOrderModel.getData(),
                    oUserData  = this._oUserModel.getData();

                
                let oParams = {
                    OrderID      : oModelData.workOrder,
                    Material     : oModelData.material,
                    Quantity     : oModelData.Quantity,
                    Plant        : oUserData.userPlant,
                    StoreLocation: oUserData.userStoreLocation
                }

                this._oDataModel.callFunction("/PostNotification", {
                        method       : "POST",
                        urlParameters: oParams,
                        success      : (oData, response) => {
                            MessageBox.success(this._i18n.getText("MaterialAddded"));
                            //reset Material fields
                            this._oWorkOrderModel.setProperty("/material"           , "");
                            this._oWorkOrderModel.setProperty("/materialDescription", "");
                            this._oWorkOrderModel.setProperty("/quantityInfoVisible", false);
                            this._oWorkOrderModel.setProperty("/Quantity"           , "");
                            this._oWorkOrderModel.setProperty("/enableSave"         , false);
                        },
                        error        : oError => {
                            let sErrorMsg = JSON.parse(oError.responseText).error.message.value;
                            MessageBox.error(sErrorMsg);
                            //reset Quantity field
                            this._oWorkOrderModel.setProperty("/Quantity"  , "");
                            this._oWorkOrderModel.setProperty("/enableSave", false);
                        }
                      });
            },

            _setInitialData: function(){
                 //initial setup upon opening the app
                 this._oWorkOrderModel = new JSONModel({
                    enableSave            : false,
                    materialInfoVisible   : false,
                    quantityInfoVisible   : false,
                    inputPopulated        : false,
                    woOrderFound          : true,
                    quantityValueState    : "None",
                    materialWarningVisible: false
                });
                this.getView().setModel(this._oWorkOrderModel , "workOrderModel");
            },

            _getWorkOrder: function(sWoNumber){
                return new Promise((resolve, reject) => {
                    let sPath = `/WorkOrder('${sWoNumber}')`;
                    this._oDataModel.read(sPath, {
                        success: oResult => {
                            //set Order info
                            this._oWorkOrderModel.setProperty("/workOrder"           , oResult.OrderID);
                            this._oWorkOrderModel.setProperty("/workOrderDescription", oResult.Text);
                            this._oWorkOrderModel.setProperty("/woOrderFound"        , true);

                            //show material fileds
                            this._oWorkOrderModel.setProperty("/materialInfoVisible" , true);

                            //quantity fields are hidden until matiral is successfully found
                            this._oWorkOrderModel.setProperty("/quantityInfoVisible" , false);

                            //save button is only enabled once quantity is entered.
                            this._oWorkOrderModel.setProperty("/enableSave"          , false);

                            //reset material fields in case of material re-scan
                            this._oWorkOrderModel.setProperty("/material", "");
                            this._oWorkOrderModel.setProperty("/materialDescription", "");
                            resolve();
                        },
                        error: function(oError) {
                            this._setInitialData();
                            let sErrorMsg = JSON.parse(oError.responseText).error.message.value;

                            //set error message to the IllustratedMessage description field
                            this._oWorkOrderModel.setProperty("/OrderNotFoundDescription", sErrorMsg);
                            this._oWorkOrderModel.setProperty("/woOrderFound"            , false);
                        }.bind(this)
                    });
                });
            },

            _getMaterial: function(sMaterialnumber){
                let sPath              = `/Material`,
                    sUserPlant         = this._oUserModel.getProperty("/userPlant"),
                    suserStoreLocation = this._oUserModel.getProperty("/userStoreLocation");
                this._oDataModel.read(sPath, {
                    filters: [
                        new Filter("MaterialNumber" , FilterOperator.EQ, sMaterialnumber),
                        new Filter("Plant"          , FilterOperator.EQ, sUserPlant),
                        new Filter("StorageLocation", FilterOperator.EQ, suserStoreLocation)
                    ],
                    success: oResult => {
                        //set material info
                        this._oWorkOrderModel.setProperty("/material"           , oResult.results[0].MaterialNumber);
                        this._oWorkOrderModel.setProperty("/materialDescription", oResult.results[0].Description);
                        this._oWorkOrderModel.setProperty("/unitOfMeasure"      , oResult.results[0].Uom);
                        this._oWorkOrderModel.setProperty("/quantityInStock"    , parseFloat(oResult.results[0].QuantityInStock));
                        this._oWorkOrderModel.setProperty("/Quantity"           , "");
                        this._oWorkOrderModel.setProperty("/quantityValueState" , "None");
                        this._oWorkOrderModel.setProperty("/quantityInfoVisible", true);

                        //if remaining quantity is 0
                        if (parseFloat(oResult.results[0].QuantityInStock) < 1){
                            this._oWorkOrderModel.setProperty("/quantityInfoVisible"   , false);
                            this._oWorkOrderModel.setProperty("/materialWarningVisible", true);
                        } else {
                            this._oWorkOrderModel.setProperty("/materialWarningVisible", false);
                        }
                    },
                    error: function(oError) {
                        let sErrorMsg = JSON.parse(oError.responseText).error.message.value;
                        MessageBox.error(sErrorMsg);

                        //reset material fields
                        this._oWorkOrderModel.setProperty("/material"           , "");
                        this._oWorkOrderModel.setProperty("/materialDescription", "");
                    }.bind(this)
                });
            },

            _getCurrentUserInfo: function(){
                return new Promise((resolve, reject) => {
                    this._oUserModel = new JSONModel({
                        enableSave         : false,
                        materialInfoVisible: false,
                        quantityInfoVisible: false,
                        inputPopulated     : false,
                        woOrderFound       : true,
                        userInfoVisible    : false
                    });
                    this.getView().setModel(this._oUserModel , "userModel");

                    let sCurrentUser = sap.ushell.Container.getService("UserInfo"),
                        sSapUsername = sap.ushell.Container.getService("UserInfo").getEmail() ? 
                                        sap.ushell.Container.getService("UserInfo").getEmail().split("@")[0] :
                                        sap.ushell.Container.getService("UserInfo").getId();
                                      
                    this._oUserModel.setProperty("/user", `${sCurrentUser.getFullName()} (${sSapUsername.toUpperCase()})`);
                    let sPath = `/User('${sSapUsername.toUpperCase()}')`;

                    //use for testing locally. DEFAULT_USER does not exist in the backend
                    // this._oUserModel.setProperty("/user", "JBULDA");
                    // let sPath = `/User('JBULDA')`;

                    this._oDataModel.read(sPath, {
                        success: oResult => {
                            this._oUserModel.setProperty("/userInfoVisible"  , true);
                            this._oUserModel.setProperty("/userPlant"        , oResult.Plant);
                            this._oUserModel.setProperty("/userStoreLocation", oResult.StorageLocation);
                        },
                        error: function(oError) {
                            let sErrorMsg =  JSON.parse(oError.responseText).error.message.value;
                            this._oUserModel.setProperty("/UserNotFoundDescription", sErrorMsg);
                        }.bind(this)
                    });
                });
            }
        });
    });
