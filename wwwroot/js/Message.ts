class Message {

    public timesUsed:number = 5;
    constructor(private msg:string){}

    show() { 
        alert(this.msg);
        console.log(this.msg);
    }
}