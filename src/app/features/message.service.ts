import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MessageService {

  m = new Subject<any>();
  mObservable$ = this.m.asObservable();

  sendMessageToParent(msj: string, params: any) {
    window.parent.postMessage({ "message": msj, params: params }, '*');

  }

  listenMessageFromParent() {
    window.addEventListener('message', (event) => {
      this.m.next({ message: event.data.message, params: event.data.params });
      console.log('Message received from parent:', event.data);
    });
  }

  addFeatures(): Observable<any> {

    return this.mObservable$;
  }

}
